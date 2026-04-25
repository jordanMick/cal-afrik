'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, UtensilsCrossed, Lock, Calendar, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'
import { supabase } from '@/lib/supabase'

// --- HELPERS D'EXTRACTION ---

function normalizeMenuText(raw: string): string {
    let text = raw
        .replace(/\*\*/g, '')
        .replace(/###|##|# /g, '')
        .replace(/a definir/gi, 'Repas local équilibré')
    const keywords = ['Petit-déjeuner', 'Petit-déj', 'Déjeuner', 'Collation', 'Dîner', 'Jour', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    keywords.forEach(k => {
        const regex = new RegExp(`([^\\n])\\s*(---*\\s*)?(${k})`, 'gi')
        text = text.replace(regex, (match, p1, p2, p3, offset) => {
            // Empêcher de couper "Petit-déjeuner" en "Petit-\ndéjeuner"
            if (k.toLowerCase() === 'déjeuner') {
                const before = text.substring(0, offset + p1.length).toLowerCase()
                if (before.endsWith('petit-') || before.endsWith('petit')) {
                    return match
                }
            }
            return p1 + '\n' + p3
        })
    })
    return text.replace(/---*/g, '').replace(/\s{2,}/g, ' ').trim()
}

function extractDayFromWeek(weekText: string, targetDate: Date): string | null {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const targetDay = dayNames[targetDate.getDay()]
    const formattedDate = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`
    const lines = weekText.split('\n')
    let startIdx = -1
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        const isHeader = (line.includes(targetDay) && (line.includes(formattedDate) || line.includes(':'))) || (line.includes('jour') && line.includes(targetDay))
        if (isHeader && !line.includes(' du ') && !line.includes(' au ')) { startIdx = i; break; }
    }
    if (startIdx === -1) return null
    let extractedLines = [lines[startIdx]]
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        if (dayNames.some(d => line.startsWith(d) || line.includes('jour'))) break
        extractedLines.push(lines[i])
    }
    const result = extractedLines.join('\n').trim()
    return result.length > 30 ? result : null
}

function extractSlotFromDay(dayText: string, slotKey: MealSlotKey): string | null {
    const slotKeywords: Record<string, string[]> = {
        petit_dejeuner: ['petit', 'matin'],
        dejeuner: ['déjeuner', 'midi'],
        collation: ['collation', 'goûter'],
        diner: ['dîner', 'soir']
    }
    const targets = slotKeywords[slotKey]
    const lines = dayText.split('\n').map(l => l.trim())
    let startIdx = -1
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].toLowerCase()
        if (targets.some(t => l.includes(t)) && (targets.some(t => l.startsWith(t)) || /^\d+\.\s*/.test(l) || /^[*-]\s*/.test(l))) {
            if (slotKey === 'dejeuner' && l.includes('petit')) continue
            startIdx = i
            break
        }
    }
    if (startIdx === -1) return null
    const otherSlots = Object.entries(slotKeywords).filter(([key]) => key !== slotKey).map(([_, keywords]) => keywords).flat()
    let extractedLines = [lines[startIdx]]
    for (let i = startIdx + 1; i < lines.length; i++) {
        const l = lines[i].toLowerCase()
        if (otherSlots.some(s => l.startsWith(s))) break
        extractedLines.push(lines[i])
    }
    return extractedLines.join('\n').trim()
}

function renderMenuBlock(menuText: string): React.ReactNode[] {
    const sep = '---DATA---'
    const dataIdx = menuText.indexOf(sep)
    const cleanMenuText = dataIdx !== -1 ? menuText.substring(0, dataIdx).trim() : menuText
    const lines = normalizeMenuText(cleanMenuText).split('\n').map(l => l.trim()).filter(Boolean)

    const rows: React.ReactNode[] = []
    let currentDayBlock: React.ReactNode[] = []
    let currentDayKey = ''

    const flushDayBlock = () => {
        if (!currentDayKey || currentDayBlock.length === 0) return
        rows.push(<div key={`day-${currentDayKey}`} style={{ marginTop: '12px', marginBottom: '16px', padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>{currentDayBlock}</div>)
        currentDayBlock = [], currentDayKey = ''
    }

    lines.forEach((line, idx) => {
        const dayRegex = /^[-*\s]*(\d+\.\s*)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?[:\s]*$/i
        const jourXRegex = /^(Jour\s*\d+\s*[:\s]*)(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i
        const isDayHeader = dayRegex.test(line) || jourXRegex.test(line)
        const isMealHeader = /^[\s*-]*(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b/i.test(line)

        if (isDayHeader) {
            flushDayBlock()
            const dateTitle = line.replace(/^[-*\s]*/, '').trim()
            currentDayKey = `${idx}-${dateTitle}`
            currentDayBlock.push(<div key={`tag-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, var(--warning), #d97706)', padding: '6px 16px', borderRadius: '12px', marginBottom: '14px' }}><span style={{ color: '#fff', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>{dateTitle}</span></div>)
            return
        }

        const node = isMealHeader ? (
            <p key={`meal-${idx}`} style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '800', marginTop: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', wordBreak: 'break-word' }}><span style={{ width: '4px', height: '14px', background: 'var(--accent)', borderRadius: '2px', flexShrink: 0 }} />{line}</p>
        ) : (
            <p key={`line-${idx}`} style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', marginTop: '4px', opacity: 0.9, paddingLeft: currentDayKey ? '12px' : '0', wordBreak: 'break-word' }}>{line}</p>
        )
        if (currentDayKey) currentDayBlock.push(node)
        else rows.push(node)
    })
    flushDayBlock()
    return rows
}

export default function MenusPage() {
    const router = useRouter()
    const { profile, chatSuggestedMenus, setPendingScannerPrefill, clearChatSuggestedMenu } = useAppStore()
    const [menuTab, setMenuTab] = useState<'today' | 'tomorrow' | 'week'>('today')

    const effectiveTier = getEffectiveTier(profile)
    const canAccessFutureMenus = effectiveTier === 'pro' || effectiveTier === 'premium'

    // Limites de scans (Uniquement pour le plan PRO)
    const scansUsedToday = profile?.scan_feedbacks_today || 0
    const paidScans = profile?.paid_scans_remaining || 0
    const isLimitReached = effectiveTier === 'pro' && scansUsedToday >= 4 && paidScans <= 0

    const now = new Date()
    const currentHour = now.getHours(), currentSlotKey = getMealSlot(currentHour), todayStr = now.toISOString().split('T')[0]
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); const yesterdayStr = yesterday.toISOString().split('T')[0]

    const targetDate = new Date(now)
    if (now.getHours() >= 21) { targetDate.setDate(targetDate.getDate() + 1) }
    const targetDateStr = targetDate.toISOString().split('T')[0]
    const isTargetToday = targetDateStr === todayStr

    const handleClearMenu = async (kind: 'today' | 'tomorrow' | 'week', slot?: string) => {
        // Vider le state local
        if (kind === 'today' && slot) {
            clearChatSuggestedMenu('today', slot)
        } else if (kind === 'tomorrow') {
            useAppStore.getState().setChatSuggestedMenu('tomorrow', 'DELETED')
        } else if (kind === 'week') {
            clearChatSuggestedMenu('week')
        }
        
        toast.success(kind === 'today' ? "Retiré" : "Planning supprimé")

        const uid = profile?.user_id || profile?.id
        if (uid) {
            const nextMenus = { ...chatSuggestedMenus }
            if (kind === 'today' && slot) {
                const nextToday = { ...nextMenus.today }
                delete nextToday[slot]
                nextMenus.today = nextToday
            } else if (kind === 'tomorrow') {
                nextMenus.tomorrow = 'DELETED'
            } else if (kind === 'week') {
                nextMenus.week = null
            }
            try {
                await supabase.from('user_profiles').update({ suggested_menus_json: nextMenus }).eq('user_id', uid)
            } catch (err) {
                console.error(err)
            }
        }
    }

    const resolvedMenus = useMemo(() => {
        const result: Record<string, any> = { 
            today: { petit_dejeuner: null, dejeuner: null, collation: null, diner: null }, 
            tomorrow: null, 
            week: null 
        }
        
        const isT = chatSuggestedMenus.date === todayStr
        const isY = chatSuggestedMenus.date === yesterdayStr

        // 1. SEMAINE (Passage complet)
        if (isT) result.week = chatSuggestedMenus.week

        // 2. DEMAIN (Calcul strict de la date de demain)
        const tomorrowDate = new Date(now)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        
        if (isT && chatSuggestedMenus.tomorrow === 'DELETED') {
            result.tomorrow = null
        } else if (isT && chatSuggestedMenus.tomorrow) {
            result.tomorrow = chatSuggestedMenus.tomorrow
        } else if (result.week && (isT || isY)) {
            result.tomorrow = extractDayFromWeek(result.week, tomorrowDate)
        }

        // 3. AUJOURD'HUI (Strictement aujourd'hui)
        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        slots.forEach(slot => {
            // Priorité 1 : Menu spécifique aujourd'hui
            if (isT && chatSuggestedMenus.today?.[slot]) {
                result.today[slot] = chatSuggestedMenus.today[slot]
            }
            // Priorité 2 : Extraction depuis Semaine pour AUJOURD'HUI
            else if (result.week && (isT || isY)) {
                const dayMenu = extractDayFromWeek(result.week, now)
                if (dayMenu) result.today[slot] = extractSlotFromDay(dayMenu, slot)
            }
        })

        return result
    }, [chatSuggestedMenus, todayStr, yesterdayStr])

    const renderTodaySlots = () => {
        const text = resolvedMenus.today[currentSlotKey]
        const hasExplicitMenu = !!(chatSuggestedMenus.today?.[currentSlotKey])
        if (!text || (!isTargetToday && !hasExplicitMenu)) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <UtensilsCrossed size={36} color="var(--accent)" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                        {now.getHours() >= 21 ? 'Journée terminée !' : 'Aucun menu pour cette heure planifié'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {now.getHours() >= 21 
                            ? 'Ton menu d\'aujourd\'hui est archivé. Découvre déjà celui de demain dans l\'onglet dédié !' 
                            : 'Demande un menu à Coach Yao pour commencer ton planning.'}
                    </p>
                </div>
            )
        }

        return (
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '24px', border: '1px solid var(--accent)', boxShadow: '0 8px 30px rgba(var(--accent-rgb), 0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ padding: '6px 14px', background: 'var(--accent)', borderRadius: '10px', color: '#fff', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {SLOT_LABELS[currentSlotKey]} - EN COURS
                    </div>
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.7' }}>{renderMenuBlock(text)}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button onClick={() => handleClearMenu('today', currentSlotKey)} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Ignorer</button>
                    {text.includes('---DATA---') && (
                        <button 
                            disabled={isLimitReached}
                            onClick={() => {
                                if (isLimitReached) return;
                                const idx = text.indexOf('---DATA---'); 
                                if (idx !== -1) { 
                                    try { 
                                        const data = JSON.parse(text.substring(idx + 10).trim()); 
                                        setPendingScannerPrefill({ items: data.items, slot: currentSlotKey }); 
                                        clearChatSuggestedMenu('today', currentSlotKey); 
                                        router.push('/scanner'); 
                                    } catch (e) { toast.error("Erreur"); } 
                                }
                            }} 
                            style={{ 
                                flex: 2, 
                                padding: '14px', 
                                borderRadius: '16px', 
                                background: isLimitReached ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, var(--accent), var(--success))', 
                                color: isLimitReached ? 'var(--text-muted)' : '#fff', 
                                border: 'none', 
                                fontSize: '13px', 
                                fontWeight: '700', 
                                cursor: isLimitReached ? 'not-allowed' : 'pointer', 
                                boxShadow: isLimitReached ? 'none' : '0 4px 15px rgba(var(--accent-rgb), 0.3)' 
                            }}
                        >
                            {isLimitReached ? '🚫 Limite de repas atteinte' : '✅ Choisir ce repas'}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px', position: 'relative' }}>
            {/* Header Premium */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <ArrowLeft size={22} />
                </button>
                <div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' }}>Planning Intelligent</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Gère tes repas en un clic</p>
                </div>
            </div>

            {/* Navigation par Onglets */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '18px', padding: '6px', marginBottom: '32px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                <button 
                    onClick={() => setMenuTab('today')} 
                    style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer' }}
                >
                    Aujourd'hui
                </button>
                
                <button 
                    onClick={() => { 
                        if (!canAccessFutureMenus) {
                            toast.warning("Le menu de demain est réservé aux membres PRO et PREMIUM.", { icon: '🔐' })
                            return
                        }
                        setMenuTab('tomorrow') 
                    }} 
                    style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                    Demain {!canAccessFutureMenus && <Lock size={12} opacity={0.5} />}
                </button>
                
                <button 
                    onClick={() => { 
                        if (effectiveTier !== 'premium') {
                            toast.warning("Le planning de la semaine est une exclusivité PREMIUM.", { icon: '👑' })
                            return
                        }
                        setMenuTab('week') 
                    }} 
                    style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                    Semaine {effectiveTier !== 'premium' && <Lock size={12} opacity={0.5} />}
                </button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={menuTab} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                    {menuTab === 'today' ? renderTodaySlots() : (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '32px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                            {(() => {
                                const content = menuTab === 'tomorrow' ? resolvedMenus.tomorrow : resolvedMenus.week
                                if (content && content !== 'DELETED') return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ padding: '8px 16px', background: menuTab === 'tomorrow' ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(var(--warning-rgb), 0.1)', borderRadius: '12px', width: 'fit-content' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '900', color: menuTab === 'tomorrow' ? 'var(--accent)' : 'var(--warning)' }}>
                                            {menuTab === 'tomorrow' ? '📅 PRÉVU POUR DEMAIN' : '🗓️ PLANNING SEMAINE'}
                                        </span>
                                    </div>
                                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '4px' }}>
                                            {renderMenuBlock(content as string)}
                                        </div>
                                        <button onClick={() => handleClearMenu(menuTab === 'tomorrow' ? 'tomorrow' : 'week')} style={{ width: 'fit-content', padding: '12px 20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>Retirer ce planning</button>
                                    </div>
                                )
                                return <div style={{ textAlign: 'center', padding: '60px 0' }}><Calendar size={48} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '16px' }} /><p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Aucun menu planifié ici.</p></div>
                            })()}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
