'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ArrowLeft, UtensilsCrossed, MessageSquareText, Flame } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'

const ACCENT_COLOR = 'var(--accent)'

function normalizeMenuText(raw: string): string {
    const base = raw
        .replace(/\*\*/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, '\n$1')
        .replace(/\s+(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b/gi, '\n$1')
        .replace(/\s*-\s+/g, '\n- ')
        .replace(/\s*→\s*/g, '\n→ ')
        .replace(/a definir/gi, 'Repas local équilibré')
        .trim()
    return base
}

function renderMenuBlock(menuText: string) {
    const sep = '---DATA---'
    const dataIdx = menuText.indexOf(sep)
    const cleanMenuText = dataIdx !== -1 ? menuText.substring(0, dataIdx).trim() : menuText

    const normalized = normalizeMenuText(cleanMenuText)
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

    const rows: React.ReactNode[] = []
    let currentDayBlock: React.ReactNode[] = []
    let currentDayKey = ''

    const flushDayBlock = () => {
        if (!currentDayKey || currentDayBlock.length === 0) return

        rows.push(
            <div key={`day-${currentDayKey}`} style={{
                marginTop: '12px',
                marginBottom: '16px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                {currentDayBlock}
            </div>
        )
        currentDayBlock = []
        currentDayKey = ''
    }

    lines.forEach((line, idx) => {
        const isHeader = /^(menu\s+)/i.test(line) ||
            /^[-*\s]*(\d+\.\s*)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?[:\s]*/i.test(line)
        const isMealLine = /^[\s*-]*(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b.*?:/i.test(line)

        if (isHeader) {
            if (/^menu\s+/i.test(line)) {
                flushDayBlock()
                rows.push(
                    <p key={`menu-line-${idx}`} style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '800', marginTop: idx === 0 ? '0' : '12px', letterSpacing: '0.2px' }}>
                        {line}
                    </p>
                )
            } else {
                flushDayBlock()
                const forcedSplit = line.match(/^[-*\s]*((?:\d+\.\s*)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?)[:\s]*(.*)$/i)
                const dateTitle = forcedSplit ? forcedSplit[1] : line
                const trailing = forcedSplit ? forcedSplit[2] : ''
                currentDayKey = `${idx}-${dateTitle}`
                currentDayBlock.push(
                    <div key={`header-tag-${idx}`} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, var(--warning), #d97706)',
                        padding: '4px 14px',
                        borderRadius: '99px',
                        marginBottom: '12px',
                        boxShadow: '0 4px 12px rgba(var(--warning-rgb), 0.2)'
                    }}>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Jour</span>
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: '800' }}>{dateTitle}</span>
                    </div>
                )
                if (trailing) {
                    currentDayBlock.push(
                        <p key={`menu-line-trailing-${idx}`} style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', wordBreak: 'break-word', marginTop: '6px' }}>
                            {trailing}
                        </p>
                    )
                }
            }
            return
        }

        if (isMealLine) {
            const node = (
                <div key={`menu-line-${idx}`} style={{ marginTop: '12px', marginBottom: '14px' }}>
                    <p style={{ color: '#e5e7eb', fontSize: '13px', lineHeight: '1.6', wordBreak: 'break-word', marginTop: '6px' }}>
                        {line}
                    </p>
                </div>
            )
            if (currentDayKey) currentDayBlock.push(node)
            else rows.push(node)
            return
        }

        const node = (
            <p key={`menu-line-${idx}`} style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.55', marginTop: '6px', wordBreak: 'break-word' }}>
                {line}
            </p>
        )
        if (currentDayKey) currentDayBlock.push(node)
        else rows.push(node)
    })

    flushDayBlock()

    return rows
}

export default function MenusPage() {
    const router = useRouter()
    const { profile, chatSuggestedMenus } = useAppStore()

    const [menuTab, setMenuTab] = useState<'today' | 'tomorrow' | 'week'>('today')

    const effectiveTier = getEffectiveTier(profile)
    const canAccessFutureMenus = effectiveTier === 'pro' || effectiveTier === 'premium'

    const currentHour = new Date().getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const todayStr = new Date().toISOString().split('T')[0]

    let activeMenuText = (chatSuggestedMenus.date === todayStr)
        ? (menuTab === 'today'
            ? chatSuggestedMenus.today?.[currentSlotKey]
            : menuTab === 'tomorrow'
                ? chatSuggestedMenus.tomorrow
                : chatSuggestedMenus.week)
        : null

    // Fallback intelligent depuis la semaine vers les jours individuels
    if (chatSuggestedMenus.date === todayStr && chatSuggestedMenus.week && !activeMenuText) {
        const targetDate = new Date()
        if (menuTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1)

        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
        const targetDay = dayNames[targetDate.getDay()]
        const formattedDate = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`
        const dateKey = `${targetDay} ${formattedDate}`

        const weekText = chatSuggestedMenus.week
        const dateIdx = weekText?.toLowerCase().indexOf(dateKey.toLowerCase()) ?? -1

        if (dateIdx !== -1) {
            const nextDayIdx = weekText.toLowerCase().indexOf(dayNames[(targetDate.getDay() + 1) % 7], dateIdx + 10)
            let dayContent = nextDayIdx !== -1
                ? weekText.substring(dateIdx, nextDayIdx).trim()
                : weekText.substring(dateIdx).trim()

            if (menuTab === 'tomorrow') {
                activeMenuText = dayContent
            } else if (menuTab === 'today') {
                // Essayer d'extraire le créneau actuel depuis le menu du jour de la semaine
                const slotKeywords: Record<string, string[]> = {
                    petit_dejeuner: ['petit', 'matin'],
                    dejeuner: ['dejeuner', 'midi'],
                    collation: ['collation', 'gouter', '4h'],
                    diner: ['diner', 'soir']
                }
                const keywords = slotKeywords[currentSlotKey] || []
                const lines = dayContent.split('\n')
                const slotLineIdx = lines.findIndex(l => keywords.some(k => l.toLowerCase().includes(k)))

                if (slotLineIdx !== -1) {
                    let extracted = lines[slotLineIdx]
                    for (let i = slotLineIdx + 1; i < lines.length; i++) {
                        if (['petit', 'dejeuner', 'collation', 'diner'].some(s => lines[i].toLowerCase().includes(s))) break
                        extracted += '\n' + lines[i]
                    }
                    activeMenuText = extracted.trim()
                }
            }
        }
    }

    const renderTodaySlots = () => {
        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        const todayMenus = chatSuggestedMenus.date === todayStr ? chatSuggestedMenus.today || {} : {}
        const activeSlots = slots.filter(s => !!todayMenus[s])

        if (activeSlots.length === 0 && !activeMenuText) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <UtensilsCrossed size={36} color="var(--accent)" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Aucun menu prévu pour aujourd'hui
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px', maxWidth: '80%' }}>
                        Demande à Coach Yao de te composer un menu adapté à tes objectifs !
                    </p>
                    <button onClick={() => router.push('/coach')} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '16px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.3)' }}>
                        <MessageSquareText size={20} /> Parler au Coach
                    </button>
                </div>
            )
        }

        // Si on a un fallback depuis la semaine mais pas de menu "creneau" spécifique
        if (activeSlots.length === 0 && activeMenuText) {
            return (
                <div>
                  <div style={{ marginBottom: '12px', padding: '4px 10px', background: 'var(--accent)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '800', width: 'fit-content' }}>
                      {SLOT_LABELS[currentSlotKey]} (Planning Semaine)
                  </div>
                  {renderMenuBlock(activeMenuText)}
                </div>
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {activeSlots.map(slot => {
                    const text = todayMenus[slot]!
                    return (
                        <div key={slot} style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ padding: '4px 10px', background: slot === currentSlotKey ? 'var(--accent)' : 'var(--bg-tertiary)', borderRadius: '8px', color: slot === currentSlotKey ? '#fff' : 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                                    {SLOT_LABELS[slot]} {slot === currentSlotKey ? ' (En cours)' : ''}
                                </div>
                            </div>
                            
                            {renderMenuBlock(text)}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button
                                    onClick={() => {
                                        const { clearChatSuggestedMenu } = useAppStore.getState()
                                        clearChatSuggestedMenu('today', slot)
                                        toast.success("Menu supprimé")
                                    }}
                                    style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Supprimer
                                </button>
                                {text.includes('---DATA---') && (
                                    <button
                                        onClick={() => {
                                            const sep = '---DATA---'
                                            const idx = text.indexOf(sep)
                                            if (idx !== -1) {
                                                const jsonPart = text.substring(idx + sep.length).trim()
                                                try {
                                                    const data = JSON.parse(jsonPart)
                                                    const { setPendingScannerPrefill } = useAppStore.getState()
                                                    setPendingScannerPrefill({ items: data.items, slot: slot })
                                                    router.push('/scanner')
                                                } catch (e) { toast.error("Erreur technique") }
                                            }
                                        }}
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        ✅ Choisir
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderSingleMenu = (text: string, kind: 'tomorrow' | 'week') => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>{renderMenuBlock(text)}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => {
                        const { clearChatSuggestedMenu } = useAppStore.getState()
                        clearChatSuggestedMenu(kind)
                        toast.success("Suggestion supprimée")
                    }}
                    style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                    Supprimer
                </button>
            </div>
        </div>
    )

    useEffect(() => {
        if (!canAccessFutureMenus && (menuTab === 'tomorrow' || menuTab === 'week')) {
            setMenuTab('today')
        }
    }, [canAccessFutureMenus, menuTab])

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px', position: 'relative', overflowX: 'hidden' }}>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Mes Menus du Coach</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>Suggestions de repas par Coach Yao</p>
                </div>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '14px', padding: '4px', marginBottom: '20px' }}>
                <button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                    Aujourd'hui
                </button>
                <button
                    onClick={() => {
                        if (!canAccessFutureMenus) {
                            toast.info("Menu Demain réservé aux plans Pro et Premium.")
                            return
                        }
                        setMenuTab('tomorrow')
                    }}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}
                >
                    Demain {!canAccessFutureMenus ? '🔒' : ''}
                </button>
                <button
                    onClick={() => {
                        if (effectiveTier !== 'premium') {
                            toast.info("Menu Semaine réservé exclusivement au plan Premium.")
                            return
                        }
                        setMenuTab('week')
                    }}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}
                >
                    Semaine {effectiveTier !== 'premium' ? '🔒' : ''}
                </button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', border: '0.5px solid var(--border-color)', padding: '20px', minHeight: '60vh' }}>
                {menuTab === 'today' ? renderTodaySlots() : (activeMenuText ? renderSingleMenu(activeMenuText, menuTab) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                            <UtensilsCrossed size={36} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                            Aucun menu prévu pour {menuTab === 'tomorrow' ? "demain" : "cette semaine"}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px', maxWidth: '80%' }}>
                            Demande à Coach Yao de te composer un menu adapté à tes objectifs !
                        </p>

                        <button
                            onClick={() => router.push('/coach')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'linear-gradient(135deg, var(--accent), var(--success))',
                                color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '16px',
                                fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.3)'
                            }}
                        >
                            <MessageSquareText size={20} />
                            Parler au Coach
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}