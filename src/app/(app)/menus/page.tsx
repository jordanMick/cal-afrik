'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, UtensilsCrossed, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'

// --- HELPERS D'EXTRACTION ---

function normalizeMenuText(raw: string): string {
    let text = raw
        .replace(/\*\*/g, '')
        .replace(/###|##|# /g, '')
        .replace(/a definir/gi, 'Repas local équilibré')
    const keywords = ['Petit-déjeuner', 'Petit-déj', 'Déjeuner', 'Collation', 'Dîner', 'Jour', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    keywords.forEach(k => {
        const regex = new RegExp(`([^\\n])\\s*(---*\\s*)?(${k})`, 'gi')
        text = text.replace(regex, '$1\n$3')
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
        // Un titre de section contient le mot-clé ET commence par lui ou un symbole
        if (targets.some(t => l.includes(t)) && (targets.some(t => l.startsWith(t)) || /^\d+\.\s*/.test(l) || /^[*-]\s*/.test(l))) {
            // Anti-mélange : "Petit-déjeuner" ne doit pas être pris comme "Déjeuner"
            if (slotKey === 'dejeuner' && l.includes('petit')) continue
            startIdx = i
            break
        }
    }

    if (startIdx === -1) return null

    const otherSlots = Object.entries(slotKeywords)
        .filter(([key]) => key !== slotKey)
        .map(([_, keywords]) => keywords)
        .flat()

    let extractedLines = [lines[startIdx]]
    for (let i = startIdx + 1; i < lines.length; i++) {
        const l = lines[i].toLowerCase()
        // On s'arrête UNIQUEMENT si on voit un AUTRE titre de repas
        const isNextSlotHeader = otherSlots.some(s => l.startsWith(s))
        if (isNextSlotHeader) break
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
            <p key={`meal-${idx}`} style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '800', marginTop: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '4px', height: '14px', background: 'var(--accent)', borderRadius: '2px' }} />{line}</p>
        ) : (
            <p key={`line-${idx}`} style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', marginTop: '4px', opacity: 0.9, paddingLeft: currentDayKey ? '12px' : '0' }}>{line}</p>
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

    const now = new Date()
    const currentHour = now.getHours(), currentSlotKey = getMealSlot(currentHour)
    const todayStr = now.toISOString().split('T')[0]
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // --- LOGIQUE DE BASCULE À 21H ---
    const targetDate = new Date(now)
    if (now.getHours() >= 21) {
        targetDate.setDate(targetDate.getDate() + 1)
    }
    const targetDateStr = targetDate.toISOString().split('T')[0]
    const isTargetToday = targetDateStr === todayStr

    const resolvedMenus = useMemo(() => {
        const result: Record<string, any> = { today: { petit_dejeuner: null, dejeuner: null, collation: null, diner: null }, tomorrow: null, week: null }
        const isT = chatSuggestedMenus.date === todayStr, isY = chatSuggestedMenus.date === yesterdayStr
        
        if (isT) result.week = chatSuggestedMenus.week

        // La cible du planning (Demain / Aujourd'hui)
        if (isT && chatSuggestedMenus.tomorrow) {
            result.tomorrow = chatSuggestedMenus.tomorrow
        } else if (chatSuggestedMenus.week && (isT || isY)) {
            result.tomorrow = extractDayFromWeek(chatSuggestedMenus.week, targetDate)
        }

        // AUJOURD'HUI : On extrait les slots de la cible
        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        slots.forEach(slot => {
            if (result.tomorrow) {
                result.today[slot] = extractSlotFromDay(result.tomorrow, slot)
            }
        })
        return result
    }, [chatSuggestedMenus, todayStr, yesterdayStr, targetDateStr])

    const renderTodaySlots = () => {
        // RÈGLE : Uniquement le créneau actuel
        const text = resolvedMenus.today[currentSlotKey]

        if (!text || !isTargetToday) {
            return (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <UtensilsCrossed size={36} color="var(--accent)" style={{ marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        {now.getHours() >= 21 ? "Le menu d'aujourd'hui est terminé. Prépare demain !" : "Aucun repas de prévu pour ce créneau."}
                    </p>
                </div>
            )
        }

        const isLocked = false // On n'affiche que le repas actuel, donc il est forcément débloqué
        
        return (
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '20px', border: '1px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ padding: '4px 10px', background: 'var(--accent)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '800' }}>
                        {SLOT_LABELS[currentSlotKey]} - ACTUEL
                    </div>
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{renderMenuBlock(text)}</div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button onClick={() => { clearChatSuggestedMenu('today', currentSlotKey); toast.success("Retiré"); }} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: '700' }}>Ignorer</button>
                    {text.includes('---DATA---') && (
                        <button onClick={() => {
                            const idx = text.indexOf('---DATA---'); if (idx !== -1) { try { const data = JSON.parse(text.substring(idx + 10).trim()); setPendingScannerPrefill({ items: data.items, slot: currentSlotKey }); clearChatSuggestedMenu('today', currentSlotKey); router.push('/scanner'); } catch (e) { toast.error("Erreur"); } }
                        }} style={{ flex: 2, padding: '10px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', fontSize: '12px', fontWeight: '700' }}>✅ Choisir ce repas</button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}><button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', color: 'var(--text-primary)' }}><ArrowLeft size={20} /></button><h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Planning</h1></div>
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '14px', padding: '4px', marginBottom: '24px' }}><button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Aujourd'hui</button><button onClick={() => { if (!canAccessFutureMenus) return; setMenuTab('tomorrow'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Demain</button><button onClick={() => { if (effectiveTier !== 'premium') return; setMenuTab('week'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Semaine</button></div>
            <AnimatePresence mode="wait"><motion.div key={menuTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}><div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '20px', border: '1px solid var(--border-color)' }}>
                {menuTab === 'today' ? renderTodaySlots() : (
                    <div>{(() => {
                        const content = menuTab === 'tomorrow' ? resolvedMenus.tomorrow : resolvedMenus.week
                        if (content) return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '6px 12px', background: isTargetToday ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(217, 119, 6, 0.1)', borderRadius: '10px', width: 'fit-content' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: isTargetToday ? 'var(--accent)' : '#d97706' }}>
                                        {isTargetToday ? '✨ PRÉVU POUR AUJOURD\'HUI' : '📅 PRÉVU POUR DEMAIN'}
                                    </span>
                                </div>
                                {renderMenuBlock(content as string)}
                                <button onClick={() => { clearChatSuggestedMenu(menuTab === 'tomorrow' ? 'tomorrow' : 'week'); toast.success("Supprimé"); }} style={{ width: 'fit-content', padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Supprimer</button>
                            </div>
                        )
                        return <div style={{ textAlign: 'center', padding: '40px 0' }}><p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Aucun menu.</p></div>
                    })()}</div>
                )}
            </div></motion.div></AnimatePresence>
        </div>
    )
}