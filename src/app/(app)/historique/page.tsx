'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Meal } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────
const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const MEAL_TYPE_EMOJIS: Record<string, string> = {
    petit_dejeuner: '🌅',
    dejeuner: '☀️',
    diner: '🌙',
    collation: '🥜',
}

const MEAL_TYPE_LABELS: Record<string, string> = {
    petit_dejeuner: 'Petit-déjeuner',
    dejeuner: 'Déjeuner',
    diner: 'Dîner',
    collation: 'Collation',
}

// ─── Panel détail repas ───────────────────────────────────────
function MealDetailPanel({ meal, onClose, onDelete }: {
    meal: Meal
    onClose: () => void
    onDelete: (id: string) => Promise<void>
}) {
    const [showCoach, setShowCoach] = useState(false)
    const totalKcal = (meal.protein_g * 4) + (meal.carbs_g * 4) + (meal.fat_g * 9)
    const macros = totalKcal === 0 ? { protein: 0, carbs: 0, fat: 0 } : {
        protein: Math.round((meal.protein_g * 4 / totalKcal) * 100),
        carbs: Math.round((meal.carbs_g * 4 / totalKcal) * 100),
        fat: Math.round((meal.fat_g * 9 / totalKcal) * 100),
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40 }} />
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                margin: '0 auto', maxWidth: '480px',
                background: '#1A1108', borderRadius: '24px 24px 0 0',
                border: '1px solid #2A1F14', zIndex: 50,
                maxHeight: '90vh', overflowY: 'auto', paddingBottom: '100px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                    <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px' }} />
                </div>
                {meal.image_url && (
                    <div style={{ width: '100%', height: '180px', overflow: 'hidden' }}>
                        <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                )}
                <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', flex: 1, marginRight: '12px' }}>
                            {meal.custom_name || 'Repas'}
                        </h2>
                        <span style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>{formatTime(meal.logged_at)}</span>
                    </div>
                    <p style={{ color: '#555', fontSize: '12px', marginBottom: '16px' }}>
                        {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} {MEAL_TYPE_LABELS[meal.meal_type] || ''} · {meal.portion_g}g
                    </p>

                    <div style={{ background: '#0F0A06', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '12px' }}>
                        <p style={{ color: '#C4622D', fontSize: '42px', fontWeight: '800', letterSpacing: '-2px' }}>{Math.round(meal.calories)}</p>
                        <p style={{ color: '#555', fontSize: '13px' }}>kilocalories</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        {[
                            { label: 'Protéines', value: meal.protein_g, color: '#52B788', pct: macros.protein },
                            { label: 'Glucides', value: meal.carbs_g, color: '#E9C46A', pct: macros.carbs },
                            { label: 'Lipides', value: meal.fat_g, color: '#E07040', pct: macros.fat },
                        ].map(m => (
                            <div key={m.label} style={{ background: '#0F0A06', borderRadius: '12px', padding: '12px 8px', textAlign: 'center' }}>
                                <p style={{ color: m.color, fontSize: '20px', fontWeight: '800' }}>{m.value}g</p>
                                <p style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                                <p style={{ color: '#333', fontSize: '9px', marginTop: '2px' }}>{m.pct}%</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
                            <div style={{ width: `${macros.protein}%`, background: '#52B788', borderRadius: '4px 0 0 4px' }} />
                            <div style={{ width: `${macros.carbs}%`, background: '#E9C46A' }} />
                            <div style={{ width: `${macros.fat}%`, background: '#E07040', borderRadius: '0 4px 4px 0' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ color: '#52B788', fontSize: '9px' }}>Prot. {macros.protein}%</span>
                            <span style={{ color: '#E9C46A', fontSize: '9px' }}>Gluc. {macros.carbs}%</span>
                            <span style={{ color: '#E07040', fontSize: '9px' }}>Lip. {macros.fat}%</span>
                        </div>
                    </div>

                    {meal.coach_message && (
                        <div style={{ marginBottom: '16px' }}>
                            <button onClick={() => setShowCoach(!showCoach)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: showCoach ? '#2A1F00' : 'transparent', border: '1px solid #F5A623', color: '#F5A623', fontWeight: '600', fontSize: '13px', cursor: 'pointer', textAlign: 'left', marginBottom: showCoach ? '8px' : '0' }}>
                                {showCoach ? '🤖 Conseil du coach' : '💡 Voir le conseil du coach →'}
                            </button>
                            {showCoach && (
                                <div style={{ background: '#2A1F00', borderRadius: '10px', padding: '14px', border: '1px solid #3A2F00' }}>
                                    <p style={{ color: '#FFD88A', fontSize: '12px', lineHeight: '1.6' }}>{meal.coach_message}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={onClose}
                            style={{ flex: 1, padding: '13px', borderRadius: '12px', background: '#2A1F14', border: '1px solid #333', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                            ← Retour
                        </button>
                        <button onClick={async () => { if (confirm('Supprimer ce repas ?')) { await onDelete(meal.id); onClose() } }}
                            style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: '1px solid #ff6b6b', color: '#ff6b6b', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

// ─── PAGE HISTORIQUE ─────────────────────────────────────────
export default function HistoriquePage() {
    const router = useRouter()
    const now = new Date()

    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth()) // 0-based
    const [selectedDate, setSelectedDate] = useState<string | null>(now.toISOString().split('T')[0])
    const [mealsForDate, setMealsForDate] = useState<Meal[]>([])
    const [daysWithMeals, setDaysWithMeals] = useState<Set<string>>(new Set())
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    // ─── Charger les jours qui ont des repas dans ce mois ────
    useEffect(() => {
        fetchMonthDays()
    }, [year, month])

    // ─── Charger les repas du jour sélectionné ───────────────
    useEffect(() => {
        if (selectedDate) fetchMealsForDate(selectedDate)
    }, [selectedDate])

    const fetchMonthDays = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

            const res = await fetch(`/api/meals?date_from=${firstDay}&date_to=${lastDay}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) {
                const days = new Set<string>(
                    (json.data as Meal[]).map(m => m.logged_at.split('T')[0])
                )
                setDaysWithMeals(days)
            }
        } catch (err) {
            console.error(err)
        }
    }

    const fetchMealsForDate = async (date: string) => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch(`/api/meals?date=${date}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setMealsForDate(json.data)
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteMeal = async (mealId: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await fetch(`/api/meals?id=${mealId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        })
        setMealsForDate(prev => prev.filter(m => m.id !== mealId))
        // Retirer le jour si plus de repas
        if (mealsForDate.length <= 1 && selectedDate) {
            setDaysWithMeals(prev => { const s = new Set(prev); s.delete(selectedDate); return s })
        }
    }

    // ─── Construction du calendrier ──────────────────────────
    const firstDayOfMonth = new Date(year, month, 1).getDay() // 0=dim
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const todayStr = now.toISOString().split('T')[0]

    const prevMonth = () => {
        if (month === 0) { setMonth(11); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (month === 11) { setMonth(0); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    // Cellules du calendrier (avec cases vides au début)
    const cells: (number | null)[] = [
        ...Array(firstDayOfMonth).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ]
    // Compléter pour avoir un multiple de 7
    while (cells.length % 7 !== 0) cells.push(null)

    const selectedDayMealsCalories = mealsForDate.reduce((acc, m) => acc + m.calories, 0)

    return (
        <div style={{
            minHeight: '100vh', background: '#0F0A06',
            maxWidth: '480px', margin: '0 auto',
            paddingBottom: '100px', fontFamily: 'system-ui, sans-serif',
        }}>
            {/* ─── HEADER ─── */}
            <div style={{ padding: '52px 24px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #2A1F14' }}>
                <button onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', padding: '0' }}>
                    ←
                </button>
                <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '800' }}>Historique</h1>
            </div>

            <div style={{ padding: '20px 24px' }}>

                {/* ─── CALENDRIER ─── */}
                <div style={{
                    background: '#1A1108', border: '1px solid #2A1F14',
                    borderRadius: '20px', padding: '20px', marginBottom: '20px',
                }}>
                    {/* Navigation mois */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <button onClick={prevMonth}
                            style={{ background: '#0F0A06', border: '1px solid #2A1F14', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ‹
                        </button>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '800' }}>
                            {year}/{String(month + 1).padStart(2, '0')}
                        </p>
                        <button onClick={nextMonth}
                            style={{ background: '#0F0A06', border: '1px solid #2A1F14', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ›
                        </button>
                    </div>

                    {/* Jours de la semaine */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {DAYS_FR.map(d => (
                            <div key={d} style={{ textAlign: 'center', color: '#444', fontSize: '10px', fontWeight: '700', padding: '4px 0' }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Jours du mois */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {cells.map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} />

                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const isToday = dateStr === todayStr
                            const isSelected = dateStr === selectedDate
                            const hasMeals = daysWithMeals.has(dateStr)
                            const isFuture = dateStr > todayStr

                            return (
                                <button
                                    key={day}
                                    onClick={() => !isFuture && setSelectedDate(dateStr)}
                                    disabled={isFuture}
                                    style={{
                                        position: 'relative',
                                        width: '100%', aspectRatio: '1',
                                        borderRadius: '50%',
                                        background: isSelected ? '#C4622D' : isToday ? 'rgba(196,98,45,0.2)' : 'transparent',
                                        border: isToday && !isSelected ? '1px solid #C4622D' : '1px solid transparent',
                                        color: isFuture ? '#2A1F14' : isSelected ? '#fff' : '#fff',
                                        fontSize: '13px', fontWeight: isToday || isSelected ? '800' : '400',
                                        cursor: isFuture ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    {day}
                                    {/* Point indicateur si repas */}
                                    {hasMeals && !isSelected && (
                                        <span style={{
                                            position: 'absolute', bottom: '3px',
                                            width: '4px', height: '4px', borderRadius: '50%',
                                            background: '#C4622D',
                                        }} />
                                    )}
                                    {/* Coche si jour passé avec repas */}
                                    {hasMeals && isSelected && (
                                        <span style={{ position: 'absolute', top: '1px', right: '2px', fontSize: '7px', color: '#fff' }}>✓</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ─── RÉSUMÉ SEMAINE ─── */}
                {selectedDate && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ color: '#fff', fontSize: '15px', fontWeight: '800' }}>
                                {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            {mealsForDate.length > 0 && (
                                <span style={{ color: '#C4622D', fontSize: '13px', fontWeight: '700' }}>
                                    {Math.round(selectedDayMealsCalories)} kcal
                                </span>
                            )}
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '32px', color: '#444' }}>Chargement...</div>
                        ) : mealsForDate.length === 0 ? (
                            <div style={{
                                background: '#1A1108', border: '1px solid #2A1F14',
                                borderRadius: '16px', padding: '32px', textAlign: 'center',
                            }}>
                                <p style={{ fontSize: '28px', marginBottom: '8px' }}>📋</p>
                                <p style={{ color: '#555', fontSize: '13px' }}>Aucun repas ce jour</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Résumé macros du jour */}
                                <div style={{ background: '#1A1108', border: '1px solid #2A1F14', borderRadius: '14px', padding: '14px', marginBottom: '4px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                        {[
                                            { label: 'Protéines', value: Math.round(mealsForDate.reduce((a, m) => a + m.protein_g, 0)), color: '#52B788' },
                                            { label: 'Glucides', value: Math.round(mealsForDate.reduce((a, m) => a + m.carbs_g, 0)), color: '#E9C46A' },
                                            { label: 'Lipides', value: Math.round(mealsForDate.reduce((a, m) => a + m.fat_g, 0)), color: '#E07040' },
                                        ].map(m => (
                                            <div key={m.label} style={{ background: '#0F0A06', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                                                <p style={{ color: m.color, fontSize: '16px', fontWeight: '800' }}>{m.value}g</p>
                                                <p style={{ color: '#444', fontSize: '9px', marginTop: '2px' }}>{m.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Liste repas */}
                                {mealsForDate.map(meal => (
                                    <div key={meal.id} onClick={() => setSelectedMeal(meal)}
                                        style={{
                                            background: '#1A1108', border: '1px solid #2A1F14',
                                            borderRadius: '14px', padding: '14px',
                                            display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                                        }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', background: '#2A1F14', flexShrink: 0 }}>
                                            {meal.image_url
                                                ? <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                                    {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'}
                                                </div>
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {meal.custom_name || 'Repas'}
                                            </p>
                                            <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
                                                {formatTime(meal.logged_at)} · {meal.protein_g}g prot · {meal.carbs_g}g gluc · {meal.fat_g}g lip
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ color: '#C4622D', fontSize: '15px', fontWeight: '800' }}>
                                                {Math.round(meal.calories)}<span style={{ color: '#444', fontSize: '10px' }}> kcal</span>
                                            </p>
                                            {meal.coach_message && <span style={{ fontSize: '12px' }}>🤖</span>}
                                            <span style={{ color: '#444', fontSize: '16px' }}> ›</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── DÉTAIL REPAS ─── */}
            {selectedMeal && (
                <MealDetailPanel
                    meal={selectedMeal}
                    onClose={() => setSelectedMeal(null)}
                    onDelete={handleDeleteMeal}
                />
            )}
        </div>
    )
}