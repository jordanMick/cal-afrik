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

/** Extrait le texte d'un jour précis dans un menu de la semaine */
function extractDayFromWeek(weekText: string, targetDate: Date): string | null {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const targetDay = dayNames[targetDate.getDay()]
    const formattedDate = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`
    
    const lines = weekText.split('\n')
    let startIdx = -1
    
    // On cherche une ligne qui ressemble à un TITRE de jour
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        const isHeader = (line.includes(targetDay) && (line.includes(formattedDate) || line.includes(':'))) 
                      || (line.includes('jour') && line.includes(targetDay))
        
        // On évite les phrases d'intro "Du ... au ..."
        if (isHeader && !line.includes(' du ') && !line.includes(' au ')) {
            startIdx = i
            break
        }
    }

    if (startIdx === -1) return null

    let extractedLines = [lines[startIdx]]
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        // On s'arrête si on croise un AUTRE jour en début de ligne (titre suivant)
        const isNextDay = dayNames.some(d => line.startsWith(d) || line.includes('jour'))
        if (isNextDay) break
        extractedLines.push(lines[i])
    }

    const result = extractedLines.join('\n').trim()
    return result.length > 30 ? result : null // Sécurité : si trop court, c'est probablement pas un menu
}

/** Extrait un créneau précis d'un texte de journée */
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
        if (allSlotKeywords.some(k => lineLower.includes(k)) && !currentKeywords.some(k => lineLower.includes(k))) {
            break
        }
        extracted += '\n' + lines[i]
    }
    return extracted.trim()
}

function renderMenuBlock(menuText: string): React.ReactNode[] {
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
                marginTop: '12px', marginBottom: '16px', padding: '16px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                {currentDayBlock}
            </div>
        )
        currentDayBlock = []
        currentDayKey = ''
    }

    lines.forEach((line, idx) => {
        const dayRegex = /^[-*\s]*(\d+\.\s*)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?[:\s]*$/i
        const jourXRegex = /^(Jour\s*\d+\s*[:\s]*)(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i
        const isDayHeader = dayRegex.test(line) || jourXRegex.test(line)

        const mealRegex = /^[\s*-]*(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b/i
        const isMealHeader = mealRegex.test(line)

        if (isDayHeader) {
            flushDayBlock()
            const dateTitle = line.replace(/^[-*\s]*/, '').trim()
            currentDayKey = `${idx}-${dateTitle}`
            currentDayBlock.push(
                <div key={`header-tag-${idx}`} style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: 'linear-gradient(135deg, var(--warning), #d97706)',
                    padding: '6px 16px', borderRadius: '12px', marginBottom: '14px',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)'
                }}>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{dateTitle}</span>
                </div>
            )
            return
        }

        if (isMealHeader) {
            const node = (
                <p key={`meal-header-${idx}`} style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '800', marginTop: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '14px', background: 'var(--accent)', borderRadius: '2px' }} />
                    {line}
                </p>
            )
            if (currentDayKey) currentDayBlock.push(node)
            else rows.push(node)
            return
        }

        const node = (
            <p key={`menu-line-${idx}`} style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', marginTop: '4px', opacity: 0.9, paddingLeft: currentDayKey ? '12px' : '0' }}>
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

    const resolvedMenus = useMemo(() => {
        const result: Record<string, any> = {
            today: { petit_dejeuner: null, dejeuner: null, collation: null, diner: null },
            tomorrow: null,
            week: null
        }

        const isStoreFromToday = chatSuggestedMenus.date === todayStr
        const isStoreFromYesterday = chatSuggestedMenus.date === yesterdayStr

        if (isStoreFromToday) result.week = chatSuggestedMenus.week

        if (isStoreFromToday && chatSuggestedMenus.tomorrow) {
            result.tomorrow = chatSuggestedMenus.tomorrow
        } else if (isStoreFromToday && chatSuggestedMenus.week) {
            const tom = new Date(now)
            tom.setDate(tom.getDate() + 1)
            result.tomorrow = extractDayFromWeek(chatSuggestedMenus.week, tom)
        }

        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        slots.forEach(slot => {
            if (isStoreFromToday && chatSuggestedMenus.today?.[slot]) {
                result.today[slot] = chatSuggestedMenus.today[slot]
            }
            else if (isStoreFromYesterday && chatSuggestedMenus.tomorrow) {
                result.today[slot] = extractSlotFromDay(chatSuggestedMenus.tomorrow, slot)
            }
            else if (chatSuggestedMenus.week && (isStoreFromToday || isStoreFromYesterday)) {
                const dayText = extractDayFromWeek(chatSuggestedMenus.week, now)
                if (dayText) {
                    result.today[slot] = extractSlotFromDay(dayText, slot)
                }
            }
        })
        return result
    }, [chatSuggestedMenus, todayStr, yesterdayStr])

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
                        <div key={slot} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '20px', border: `1px solid ${slot === currentSlotKey ? 'var(--accent)' : 'var(--border-color)'}`, opacity: isLocked ? 0.7 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ padding: '4px 10px', background: slot === currentSlotKey ? 'var(--accent)' : 'var(--bg-tertiary)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                                    {SLOT_LABELS[slot]} {slot === currentSlotKey ? ' (Actuel)' : ''}
                                </div>
                                {isLocked && <Lock size={14} color="var(--text-muted)" />}
                            </div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6' }}>{renderMenuBlock(text)}</div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button onClick={() => { clearChatSuggestedMenu('today', slot); toast.success("Supprimé"); }} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Supprimer</button>
                                {text.includes('---DATA---') && (
                                    <button disabled={isLocked} onClick={() => {
                                        const sep = '---DATA---'; const idx = text.indexOf(sep)
                                        if (idx !== -1) { try { const data = JSON.parse(text.substring(idx + sep.length).trim()); setPendingScannerPrefill({ items: data.items, slot: slot }); clearChatSuggestedMenu('today', slot); router.push('/scanner'); } catch (e) { toast.error("Erreur"); } }
                                    }} style={{ flex: 2, padding: '10px', borderRadius: '12px', background: isLocked ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent), var(--success))', color: isLocked ? 'var(--text-muted)' : '#fff', border: 'none', fontSize: '12px', fontWeight: '700', cursor: isLocked ? 'not-allowed' : 'pointer' }}>
                                        {isLocked ? 'Attendre l\'heure' : '✅ Choisir'}
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
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><ArrowLeft size={20} /></button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Planning</h1>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '14px', padding: '4px', marginBottom: '24px' }}>
                <button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Aujourd'hui</button>
                <button onClick={() => { if (!canAccessFutureMenus) return; setMenuTab('tomorrow'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Demain</button>
                <button onClick={() => { if (effectiveTier !== 'premium') return; setMenuTab('week'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>Semaine</button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={menuTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        {menuTab === 'today' ? renderTodaySlots() : (
                            <div>
                                {(() => {
                                    const content = menuTab === 'tomorrow' ? resolvedMenus.tomorrow : resolvedMenus.week
                                    if (content) {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {renderMenuBlock(content as string)}
                                                <button onClick={() => { clearChatSuggestedMenu(menuTab === 'tomorrow' ? 'tomorrow' : 'week'); toast.success("Supprimé"); }} style={{ width: 'fit-content', padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Supprimer ce planning</button>
                                            </div>
                                        )
                                    }
                                    return <div style={{ textAlign: 'center', padding: '40px 0' }}><p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Aucun menu disponible.</p></div>
                                })()}
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    )
}