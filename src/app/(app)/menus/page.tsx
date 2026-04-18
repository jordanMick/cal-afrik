'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, UtensilsCrossed, MessageSquareText, Lock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'

// --- HELPERS D'EXTRACTION ---

function normalizeMenuText(raw: string): string {
    return raw
        .replace(/\*\*/g, '')
        .replace(/###|##|# /g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/a definir/gi, 'Repas local équilibré')
        .trim()
}

/** Extrait le texte d'un jour précis dans un menu de la semaine */
function extractDayFromWeek(weekText: string, targetDate: Date): string | null {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const targetDay = dayNames[targetDate.getDay()]
    const formattedDate = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`
    
    // On cherche "Lundi 19/04" ou "Lundi"
    const searchKeys = [`${targetDay} ${formattedDate}`, targetDay]
    const lowerWeek = weekText.toLowerCase()
    
    let bestIdx = -1
    let usedKey = ''

    for (const key of searchKeys) {
        const idx = lowerWeek.indexOf(key.toLowerCase())
        if (idx !== -1) {
            bestIdx = idx
            usedKey = key
            break
        }
    }

    if (bestIdx === -1) return null

    // On cherche le début du jour suivant pour s'arrêter
    let endIdx = weekText.length
    for (const day of dayNames) {
        if (day === usedKey.split(' ')[0].toLowerCase()) continue
        const nextDayIdx = lowerWeek.indexOf(day, bestIdx + 5)
        if (nextDayIdx !== -1 && nextDayIdx < endIdx) {
            endIdx = nextDayIdx
        }
    }

    return weekText.substring(bestIdx, endIdx).trim()
}

/** Extrait un créneau précis (ex: Déjeuner) d'un texte de journée */
function extractSlotFromDay(dayText: string, slotKey: MealSlotKey): string | null {
    const keywords: Record<string, string[]> = {
        petit_dejeuner: ['petit', 'matin'],
        dejeuner: ['dejeuner', 'midi'],
        collation: ['collation', 'gouter', '4h'],
        diner: ['diner', 'soir']
    }
    const currentKeywords = keywords[slotKey]
    const lines = dayText.split('\n')
    
    const slotIdx = lines.findIndex(line => 
        currentKeywords.some(k => line.toLowerCase().includes(k))
    )

    if (slotIdx === -1) return null

    let extracted = lines[slotIdx]
    const allSlotKeywords = Object.values(keywords).flat()

    for (let i = slotIdx + 1; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase()
        // Si on tombe sur un autre créneau, on s'arrête
        if (allSlotKeywords.some(k => lineLower.includes(k)) && !currentKeywords.some(k => lineLower.includes(k))) {
            break
        }
        extracted += '\n' + lines[i]
    }

    return extracted.trim()
}

export default function MenusPage() {
    const router = useRouter()
    const { profile, chatSuggestedMenus, setPendingScannerPrefill, clearChatSuggestedMenu } = useAppStore()
    const [menuTab, setMenuTab] = useState<'today' | 'tomorrow' | 'week'>('today')

    const effectiveTier = getEffectiveTier(profile)
    const canAccessFutureMenus = effectiveTier === 'pro' || effectiveTier === 'premium'

    const now = new Date()
    const currentHour = now.getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const todayStr = now.toISOString().split('T')[0]
    
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // --- LOGIQUE DE CASCADE DES DONNÉES ---

    const resolvedMenus = useMemo(() => {
        const result: Record<string, any> = {
            today: { petit_dejeuner: null, dejeuner: null, collation: null, diner: null },
            tomorrow: null,
            week: null
        }

        const isStoreFromToday = chatSuggestedMenus.date === todayStr
        const isStoreFromYesterday = chatSuggestedMenus.date === yesterdayStr

        // 1. SEMAINE
        if (isStoreFromToday) result.week = chatSuggestedMenus.week

        // 2. DEMAIN
        if (isStoreFromToday && chatSuggestedMenus.tomorrow) {
            result.tomorrow = chatSuggestedMenus.tomorrow
        } else if (isStoreFromToday && chatSuggestedMenus.week) {
            // Cascade Semaine -> Demain
            const tom = new Date(now)
            tom.setDate(tom.getDate() + 1)
            result.tomorrow = extractDayFromWeek(chatSuggestedMenus.week, tom)
        }

        // 3. AUJOURD'HUI
        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        slots.forEach(slot => {
            // Priorité 1 : Menu créneau explicite d'aujourd'hui
            if (isStoreFromToday && chatSuggestedMenus.today?.[slot]) {
                result.today[slot] = chatSuggestedMenus.today[slot]
            }
            // Priorité 2 : Menu "Demain" d'hier qui devient "Aujourd'hui"
            else if (isStoreFromYesterday && chatSuggestedMenus.tomorrow) {
                result.today[slot] = extractSlotFromDay(chatSuggestedMenus.tomorrow, slot)
            }
            // Priorité 3 : Menu "Semaine" (d'hier ou d'aujourd'hui)
            else if (chatSuggestedMenus.week && (isStoreFromToday || isStoreFromYesterday)) {
                const dayText = extractDayFromWeek(chatSuggestedMenus.week, now)
                if (dayText) {
                    result.today[slot] = extractSlotFromDay(dayText, slot)
                }
            }
        })

        return result
    }, [chatSuggestedMenus, todayStr, yesterdayStr])

    // --- RENDU DES MENUS ---

    const renderTodaySlots = () => {
        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        const activeSlots = slots.filter(s => !!resolvedMenus.today[s])

        if (activeSlots.length === 0) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <UtensilsCrossed size={36} color="var(--accent)" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Aucun menu planifié</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Demande un menu à Coach Yao !</p>
                    <button onClick={() => router.push('/coach')} style={{ background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '16px', fontWeight: '700', cursor: 'pointer' }}>Parler au Coach</button>
                </div>
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {activeSlots.map(slot => {
                    const text = resolvedMenus.today[slot]!
                    const isLocked = slot !== currentSlotKey
                    
                    return (
                        <div key={slot} style={{ 
                            padding: '16px', 
                            background: 'var(--bg-secondary)', 
                            borderRadius: '20px', 
                            border: `1px solid ${slot === currentSlotKey ? 'var(--accent)' : 'var(--border-color)'}`,
                            opacity: isLocked ? 0.7 : 1,
                            transition: 'all 0.3s'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ padding: '4px 10px', background: slot === currentSlotKey ? 'var(--accent)' : 'var(--bg-tertiary)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                                    {SLOT_LABELS[slot]} {slot === currentSlotKey ? ' (C\'est le moment !)' : ''}
                                </div>
                                {isLocked && <Lock size={14} color="var(--text-muted)" />}
                            </div>

                            <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6' }}>
                                {renderMenuBlock(text)}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button
                                    onClick={() => {
                                        // On nettoie partout où il pourrait être (Today, ou via Cascade)
                                        clearChatSuggestedMenu('today', slot)
                                        toast.success("Menu retiré du planning")
                                    }}
                                    style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Supprimer
                                </button>
                                
                                {text.includes('---DATA---') && (
                                    <button
                                        disabled={isLocked}
                                        onClick={() => {
                                            const sep = '---DATA---'; const idx = text.indexOf(sep)
                                            if (idx !== -1) {
                                                try {
                                                    const data = JSON.parse(text.substring(idx + sep.length).trim())
                                                    setPendingScannerPrefill({ items: data.items, slot: slot })
                                                    // RÈGLE : Une fois choisi, il disparaît de l'affichage
                                                    clearChatSuggestedMenu('today', slot)
                                                    router.push('/scanner')
                                                } catch (e) { toast.error("Erreur technique") }
                                            }
                                        }}
                                        style={{ 
                                            flex: 2, padding: '10px', borderRadius: '12px', 
                                            background: isLocked ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent), var(--success))', 
                                            color: isLocked ? 'var(--text-muted)' : '#fff', 
                                            border: 'none', fontSize: '12px', fontWeight: '700', 
                                            cursor: isLocked ? 'not-allowed' : 'pointer' 
                                        }}
                                    >
                                        {isLocked ? 'Attendre l\'heure' : '✅ Choisir ce repas'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><ArrowLeft size={20} /></button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Mon Planning Intelligent</h1>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '14px', padding: '4px', marginBottom: '24px' }}>
                <button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Aujourd'hui</button>
                <button onClick={() => { if (!canAccessFutureMenus) return; setMenuTab('tomorrow'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Demain</button>
                <button onClick={() => { if (effectiveTier !== 'premium') return; setMenuTab('week'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Semaine</button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={menuTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {menuTab === 'today' ? renderTodaySlots() : (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '20px', border: '1px solid var(--border-color)' }}>
                            {(() => {
                        const content = menuTab === 'tomorrow' ? resolvedMenus.tomorrow : resolvedMenus.week
                        if (content) {
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {renderMenuBlock(content as string)}
                                    <button 
                                        onClick={() => {
                                            clearChatSuggestedMenu(menuTab === 'tomorrow' ? 'tomorrow' : 'week')
                                            toast.success("Menu supprimé")
                                        }}
                                        style={{ width: 'fit-content', padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                                    >
                                        Supprimer ce planning
                                    </button>
                                </div>
                            )
                        }
                        return (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Aucune donnée disponible pour cet onglet.</p>
                            </div>
                        )
                    })()}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}