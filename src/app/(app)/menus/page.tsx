'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, UtensilsCrossed, Lock, Calendar, ClipboardList } from 'lucide-react'
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
    const currentHour = now.getHours(), currentSlotKey = getMealSlot(currentHour), todayStr = now.toISOString().split('T')[0]
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); const yesterdayStr = yesterday.toISOString().split('T')[0]

    const targetDate = new Date(now)
    if (now.getHours() >= 21) { targetDate.setDate(targetDate.getDate() + 1) }
    const targetDateStr = targetDate.toISOString().split('T')[0]
    const isTargetToday = targetDateStr === todayStr

    const resolvedMenus = useMemo(() => {
        const result: Record<string, any> = { today: { petit_dejeuner: null, dejeuner: null, collation: null, diner: null }, tomorrow: null, week: null }
        const isT = chatSuggestedMenus.date === todayStr, isY = chatSuggestedMenus.date === yesterdayStr
        if (isT) result.week = chatSuggestedMenus.week
        if (isT && chatSuggestedMenus.tomorrow) result.tomorrow = chatSuggestedMenus.tomorrow
        else if (chatSuggestedMenus.week && (isT || isY)) { result.tomorrow = extractDayFromWeek(chatSuggestedMenus.week, targetDate); }

        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        slots.forEach(slot => { if (result.tomorrow) { result.today[slot] = extractSlotFromDay(result.tomorrow, slot) } })
        return result
    }, [chatSuggestedMenus, todayStr, yesterdayStr, targetDateStr])

    const renderTodaySlots = () => {
        const text = resolvedMenus.today[currentSlotKey]
        if (!text || !isTargetToday) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <UtensilsCrossed size={36} color="var(--accent)" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Journée terminée</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Rendez-vous à 21h pour découvrir ton menu de demain !</p>
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
                    <button onClick={() => { clearChatSuggestedMenu('today', currentSlotKey); toast.success("Retiré"); }} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Ignorer</button>
                    {text.includes('---DATA---') && (
                        <button onClick={() => {
                            const idx = text.indexOf('---DATA---'); if (idx !== -1) { try { const data = JSON.parse(text.substring(idx + 10).trim()); setPendingScannerPrefill({ items: data.items, slot: currentSlotKey }); clearChatSuggestedMenu('today', currentSlotKey); router.push('/scanner'); } catch (e) { toast.error("Erreur"); } }
                        }} style={{ flex: 2, padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 15px rgba(var(--accent-rgb), 0.3)' }}>✅ Choisir ce repas</button>
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
                <button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '800', transition: 'all 0.2s' }}>Aujourd'hui</button>
                <button onClick={() => { if (!canAccessFutureMenus) return; setMenuTab('tomorrow'); }} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '800', transition: 'all 0.2s' }}>Demain</button>
                <button onClick={() => { if (effectiveTier !== 'premium') return; setMenuTab('week'); }} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '800', transition: 'all 0.2s' }}>Semaine</button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={menuTab} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                    {menuTab === 'today' ? renderTodaySlots() : (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '32px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                            {(() => {
                                const content = menuTab === 'tomorrow' ? resolvedMenus.tomorrow : resolvedMenus.week
                                if (content) return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ padding: '8px 16px', background: isTargetToday ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(217, 119, 6, 0.1)', borderRadius: '12px', width: 'fit-content' }}>
                                            <span style={{ fontSize: '12px', fontWeight: '900', color: isTargetToday ? 'var(--accent)' : '#d97706' }}>
                                                {isTargetToday ? '✨ PRÉVU POUR AUJOURD\'HUI' : '📅 PRÉVU POUR DEMAIN'}
                                            </span>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '4px' }}>
                                            {renderMenuBlock(content as string)}
                                        </div>
                                        <button onClick={() => { clearChatSuggestedMenu(menuTab === 'tomorrow' ? 'tomorrow' : 'week'); toast.success("Planning supprimé"); }} style={{ width: 'fit-content', padding: '12px 20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>Retirer ce planning</button>
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