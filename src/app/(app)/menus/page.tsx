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

interface ParsedFood {
    name: string
    portion_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
}

function extractFoodsFromMenu(menuText: string): ParsedFood[] {
    const sep = '---DATA---'
    const dataIdx = menuText.indexOf(sep)

    if (dataIdx !== -1) {
        try {
            const jsonPart = menuText.substring(dataIdx + sep.length).trim()
            const data = JSON.parse(jsonPart)
            if (data.items && Array.isArray(data.items)) {
                return data.items.map((item: any) => ({
                    name: item.name || 'Aliment inconnu',
                    portion_g: item.volume_ml || item.portion_g || 150,
                    calories: item.calories || 0,
                    protein_g: item.protein_g || 0,
                    carbs_g: item.carbs_g || 0,
                    fat_g: item.fat_g || 0
                }))
            }
        } catch (e) {
            // JSON parsing échoué, fallback
        }
    }
    return []
}

function FoodCard({ food, index }: { food: ParsedFood; index: number }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setExpanded(!expanded)}
            style={{
                cursor: 'pointer',
                borderRadius: '18px',
                background: 'var(--bg-primary)',
                border: expanded ? '1.5px solid var(--accent)' : '1px solid var(--border-color)',
                padding: '14px',
                marginBottom: '10px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: expanded ? '0 8px 24px rgba(var(--accent-rgb), 0.15)' : '0 2px 8px rgba(0,0,0,0.05)'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <p style={{
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: '700',
                        marginBottom: '6px'
                    }}>
                        {food.name}
                    </p>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: '500'
                    }}>
                        ⚖️ {food.portion_g}g
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px'
                    }}>
                        <Flame size={14} color='#ef4444' fill='#ef4444' />
                        <span style={{
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            fontWeight: '800'
                        }}>
                            {Math.round(food.calories)}
                        </span>
                    </div>
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '10px',
                        fontWeight: '600'
                    }}>
                        kcal
                    </p>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid var(--border-color)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '8px'
                        }}>
                            {[
                                { label: 'Protéines', value: food.protein_g, unit: 'g', icon: '💪', color: '#3b82f6' },
                                { label: 'Glucides', value: food.carbs_g, unit: 'g', icon: '⚡', color: '#f59e0b' },
                                { label: 'Lipides', value: food.fat_g, unit: 'g', icon: '🫒', color: '#8b5cf6' }
                            ].map(macro => (
                                <div key={macro.label} style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '10px',
                                    padding: '8px 6px',
                                    textAlign: 'center',
                                    border: '0.5px solid var(--border-color)'
                                }}>
                                    <p style={{ fontSize: '16px', marginBottom: '2px' }}>{macro.icon}</p>
                                    <p style={{
                                        color: 'var(--text-primary)',
                                        fontSize: '13px',
                                        fontWeight: '700'
                                    }}>
                                        {Math.round(macro.value * 10) / 10}
                                    </p>
                                    <p style={{
                                        color: 'var(--text-muted)',
                                        fontSize: '9px',
                                        marginTop: '1px'
                                    }}>
                                        {macro.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
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

    // Extraire et afficher les aliments structurés
    const foods = extractFoodsFromMenu(menuText)
    if (foods.length > 0) {
        const totalCalories = foods.reduce((sum, f) => sum + f.calories, 0)
        const totalProtein = foods.reduce((sum, f) => sum + f.protein_g, 0)

        rows.push(
            <motion.div
                key="foods-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    marginTop: '24px',
                    marginBottom: '20px',
                    padding: '18px',
                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.08), rgba(var(--success-rgb), 0.05))',
                    border: '1px solid rgba(var(--accent-rgb), 0.15)',
                    borderRadius: '24px'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '14px',
                        background: 'rgba(var(--accent-rgb), 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.1)'
                    }}>
                        🍽️
                    </div>
                    <div>
                        <p style={{
                            color: 'var(--text-primary)',
                            fontSize: '15px',
                            fontWeight: '800',
                            margin: 0
                        }}>
                            Aliments détectés
                        </p>
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            margin: '4px 0 0 0',
                            fontWeight: '600'
                        }}>
                            {foods.length} {foods.length === 1 ? 'aliment' : 'aliments'} · {totalCalories} kcal
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {foods.map((food, idx) => (
                        <FoodCard key={`${food.name}-${idx}`} food={food} index={idx} />
                    ))}
                </div>

                {/* Summary Stats */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        marginTop: '14px',
                        paddingTop: '14px',
                        borderTop: '1px solid rgba(var(--accent-rgb), 0.2)',
                        display: 'flex',
                        gap: '8px'
                    }}
                >
                    {[
                        { icon: '🔥', label: 'Calories', value: totalCalories },
                        { icon: '💪', label: 'Protéines', value: Math.round(totalProtein * 10) / 10 }
                    ].map(stat => (
                        <div key={stat.label} style={{
                            flex: 1,
                            background: 'rgba(var(--accent-rgb), 0.08)',
                            borderRadius: '10px',
                            padding: '8px',
                            textAlign: 'center',
                            border: '0.5px solid rgba(var(--accent-rgb), 0.2)'
                        }}>
                            <p style={{ fontSize: '14px', margin: 0 }}>{stat.icon}</p>
                            <p style={{
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontWeight: '700',
                                margin: '4px 0 0 0'
                            }}>
                                {stat.value}
                            </p>
                            <p style={{
                                color: 'var(--text-muted)',
                                fontSize: '9px',
                                margin: '2px 0 0 0'
                            }}>
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </motion.div>
            </motion.div>
        )
    }

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

    // Fallback intelligent
    if ((menuTab === 'today' || menuTab === 'tomorrow') && !activeMenuText && chatSuggestedMenus.date === todayStr && chatSuggestedMenus.week) {
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
            } else {
                const slotKeywords: Record<string, string[]> = {
                    petit_dejeuner: ['petit', 'matin'],
                    dejeuner: ['dejeuner', 'midi'],
                    collation: ['collation', 'gouter', '4h'],
                    diner: ['diner', 'soir']
                }
                const keywords = slotKeywords[currentSlotKey] || []

                const sep = '---DATA---'
                const dataIdx = dayContent.indexOf(sep)
                const displayText = dataIdx !== -1 ? dayContent.substring(0, dataIdx).trim() : dayContent
                const lines = displayText.split('\n')
                const slotLineIdx = lines.findIndex(l => keywords.some(k => l.toLowerCase().includes(k)))

                if (slotLineIdx !== -1) {
                    const allSlots = ['petit', 'dejeuner', 'collation', 'diner']
                    let extracted = lines[slotLineIdx]
                    for (let i = slotLineIdx + 1; i < lines.length; i++) {
                        if (allSlots.some(s => lines[i].toLowerCase().includes(s))) break
                        extracted += '\n' + lines[i]
                    }
                    activeMenuText = extracted.trim()
                }
            }
        }
    }

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
                {activeMenuText ? (
                    <div>{renderMenuBlock(activeMenuText)}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                            <UtensilsCrossed size={36} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                            Aucun menu prévu pour {menuTab === 'today' ? "aujourd'hui" : menuTab === 'tomorrow' ? "demain" : "cette semaine"}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px', maxWidth: '80%' }}>
                            Tu n'as pas encore d'idées de plats ? Demande à Coach Yao de te composer un menu adapté à tes objectifs !
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
                )}
            </div>

        </div>
    )
}