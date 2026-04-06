'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Meal } from '@/types'

const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const MEAL_TYPE_EMOJIS: Record<string, string> = {
    petit_dejeuner: '🌅', dejeuner: '☀️', diner: '🌙', collation: '🥜',
}
const MEAL_TYPE_LABELS: Record<string, string> = {
    petit_dejeuner: 'Petit-déjeuner', dejeuner: 'Déjeuner', diner: 'Dîner', collation: 'Collation',
}

const card: React.CSSProperties = {
    background: '#161616',
    border: '0.5px solid #2a2a2a',
    borderRadius: '14px',
    padding: '14px',
    marginBottom: '8px',
}

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
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 40 }} />
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                margin: '0 auto', maxWidth: '480px',
                background: '#111', borderRadius: '20px 20px 0 0',
                border: '0.5px solid #2a2a2a', zIndex: 50,
                maxHeight: '90vh', overflowY: 'auto', paddingBottom: '100px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                    <div style={{ width: '36px', height: '4px', background: '#333', borderRadius: '2px' }} />
                </div>
                {meal.image_url && (
                    <div style={{ width: '100%', height: '180px', overflow: 'hidden' }}>
                        <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                )}
                <div style={{ padding: '20px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: '500', flex: 1, marginRight: '12px' }}>
                            {meal.custom_name || 'Repas'}
                        </h2>
                        <span style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>{formatTime(meal.logged_at)}</span>
                    </div>
                    <p style={{ color: '#555', fontSize: '12px', marginBottom: '16px' }}>
                        {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} {MEAL_TYPE_LABELS[meal.meal_type] || ''} · {meal.portion_g}g
                    </p>

                    <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '12px' }}>
                        <p style={{ color: '#fff', fontSize: '40px', fontWeight: '500', letterSpacing: '-2px' }}>{Math.round(meal.calories)}</p>
                        <p style={{ color: '#555', fontSize: '13px' }}>kilocalories</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        {[
                            { label: 'Protéines', value: meal.protein_g, pct: macros.protein },
                            { label: 'Glucides', value: meal.carbs_g, pct: macros.carbs },
                            { label: 'Lipides', value: meal.fat_g, pct: macros.fat },
                        ].map(m => (
                            <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                                <p style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>{m.value}g</p>
                                <p style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                                <p style={{ color: '#333', fontSize: '9px', marginTop: '2px' }}>{m.pct}%</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', height: '4px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
                            <div style={{ width: `${macros.protein}%`, background: '#fff', borderRadius: '4px 0 0 4px' }} />
                            <div style={{ width: `${macros.carbs}%`, background: '#888' }} />
                            <div style={{ width: `${macros.fat}%`, background: '#444', borderRadius: '0 4px 4px 0' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ color: '#666', fontSize: '9px' }}>Prot. {macros.protein}%</span>
                            <span style={{ color: '#666', fontSize: '9px' }}>Gluc. {macros.carbs}%</span>
                            <span style={{ color: '#666', fontSize: '9px' }}>Lip. {macros.fat}%</span>
                        </div>
                    </div>

                    {meal.coach_message && (
                        <div style={{ marginBottom: '16px' }}>
                            <button onClick={() => setShowCoach(!showCoach)} style={{
                                width: '100%', padding: '10px 12px', borderRadius: '10px',
                                background: 'transparent', border: '0.5px solid #333',
                                color: '#888', fontWeight: '500', fontSize: '13px',
                                cursor: 'pointer', textAlign: 'left', marginBottom: showCoach ? '8px' : '0'
                            }}>
                                {showCoach ? '🤖 Conseil du coach' : '💡 Voir le conseil du coach →'}
                            </button>
                            {showCoach && (
                                <div style={{ background: '#0a0a0a', borderRadius: '10px', padding: '14px', border: '0.5px solid #2a2a2a' }}>
                                    <p style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.6' }}>{meal.coach_message}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '13px', borderRadius: '12px',
                            background: '#1a1a1a', border: '0.5px solid #333',
                            color: '#fff', fontWeight: '500', fontSize: '13px', cursor: 'pointer'
                        }}>← Retour</button>
                        <button onClick={async () => { if (confirm('Supprimer ce repas ?')) { await onDelete(meal.id); onClose() } }} style={{
                            flex: 1, padding: '13px', borderRadius: '12px',
                            background: 'transparent', border: '0.5px solid #555',
                            color: '#888', fontWeight: '500', fontSize: '13px', cursor: 'pointer'
                        }}>🗑️ Supprimer</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default function HistoriquePage() {
    const router = useRouter()
    const now = new Date()

    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth())
    const [selectedDate, setSelectedDate] = useState<string | null>(now.toISOString().split('T')[0])
    const [mealsForDate, setMealsForDate] = useState<Meal[]>([])
    const [daysWithMeals, setDaysWithMeals] = useState<Set<string>>(new Set())
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => { fetchMonthDays() }, [year, month])
    useEffect(() => { if (selectedDate) fetchMealsForDate(selectedDate) }, [selectedDate])

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
                const days = new Set<string>((json.data as Meal[]).map(m => m.logged_at.split('T')[0]))
                setDaysWithMeals(days)
            }
        } catch (err) { console.error(err) }
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
        } catch (err) { console.error(err) }
        finally { setIsLoading(false) }
    }

    const handleDeleteMeal = async (mealId: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await fetch(`/api/meals?id=${mealId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        })
        setMealsForDate(prev => prev.filter(m => m.id !== mealId))
        if (mealsForDate.length <= 1 && selectedDate) {
            setDaysWithMeals(prev => { const s = new Set(prev); s.delete(selectedDate); return s })
        }
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const todayStr = now.toISOString().split('T')[0]

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

    const cells: (number | null)[] = [
        ...Array(firstDayOfMonth).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    const selectedDayCalories = mealsForDate.reduce((acc, m) => acc + m.calories, 0)

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif' }}>

            {/* HEADER */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '0.5px solid #1e1e1e' }}>
                <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>←</button>
                <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '500' }}>Historique</h1>
            </div>

            <div style={{ padding: '20px' }}>

                {/* CALENDRIER */}
                <div style={{ background: '#161616', border: '0.5px solid #2a2a2a', borderRadius: '18px', padding: '18px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <button onClick={prevMonth} style={{
                            background: '#111', border: '0.5px solid #2a2a2a', borderRadius: '50%',
                            width: '30px', height: '30px', color: '#fff', cursor: 'pointer', fontSize: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>‹</button>
                        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>
                            {year} / {String(month + 1).padStart(2, '0')}
                        </p>
                        <button onClick={nextMonth} style={{
                            background: '#111', border: '0.5px solid #2a2a2a', borderRadius: '50%',
                            width: '30px', height: '30px', color: '#fff', cursor: 'pointer', fontSize: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>›</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
                        {DAYS_FR.map(d => (
                            <div key={d} style={{ textAlign: 'center', color: '#444', fontSize: '10px', fontWeight: '500', padding: '4px 0' }}>{d}</div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                        {cells.map((day, i) => {
                            if (day === null) return <div key={`e-${i}`} />
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const isToday = dateStr === todayStr
                            const isSelected = dateStr === selectedDate
                            const hasMeals = daysWithMeals.has(dateStr)
                            const isFuture = dateStr > todayStr
                            return (
                                <button key={day} onClick={() => !isFuture && setSelectedDate(dateStr)} disabled={isFuture}
                                    style={{
                                        position: 'relative', width: '100%', aspectRatio: '1',
                                        borderRadius: '50%',
                                        background: isSelected ? '#fff' : isToday ? 'rgba(255,255,255,0.08)' : 'transparent',
                                        border: isToday && !isSelected ? '0.5px solid #555' : '0.5px solid transparent',
                                        color: isFuture ? '#2a2a2a' : isSelected ? '#000' : '#fff',
                                        fontSize: '12px', fontWeight: isSelected ? '500' : '400',
                                        cursor: isFuture ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                    {day}
                                    {hasMeals && !isSelected && (
                                        <span style={{ position: 'absolute', bottom: '3px', width: '3px', height: '3px', borderRadius: '50%', background: '#fff' }} />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* JOUR SÉLECTIONNÉ */}
                {selectedDate && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>
                                {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            {mealsForDate.length > 0 && (
                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                                    {Math.round(selectedDayCalories)} kcal
                                </span>
                            )}
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '32px', color: '#444' }}>Chargement...</div>
                        ) : mealsForDate.length === 0 ? (
                            <div style={{ background: '#161616', border: '0.5px solid #2a2a2a', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
                                <p style={{ fontSize: '24px', marginBottom: '8px' }}>📋</p>
                                <p style={{ color: '#444', fontSize: '13px' }}>Aucun repas ce jour</p>
                            </div>
                        ) : (
                            <div>
                                {/* macros résumé */}
                                <div style={{ background: '#161616', border: '0.5px solid #2a2a2a', borderRadius: '14px', padding: '12px', marginBottom: '8px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                        {[
                                            { label: 'Protéines', value: Math.round(mealsForDate.reduce((a, m) => a + m.protein_g, 0)) },
                                            { label: 'Glucides', value: Math.round(mealsForDate.reduce((a, m) => a + m.carbs_g, 0)) },
                                            { label: 'Lipides', value: Math.round(mealsForDate.reduce((a, m) => a + m.fat_g, 0)) },
                                        ].map(m => (
                                            <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{m.value}g</p>
                                                <p style={{ color: '#444', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {mealsForDate.map(meal => (
                                    <div key={meal.id} onClick={() => setSelectedMeal(meal)} style={{
                                        ...card, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
                                    }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', background: '#222', flexShrink: 0 }}>
                                            {meal.image_url
                                                ? <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                                                    {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'}
                                                </div>
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ color: '#fff', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {meal.custom_name || 'Repas'}
                                            </p>
                                            <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
                                                {formatTime(meal.logged_at)} · {meal.protein_g}g prot · {meal.carbs_g}g gluc
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>
                                                {Math.round(meal.calories)} <span style={{ color: '#444', fontSize: '10px' }}>kcal</span>
                                            </p>
                                            <span style={{ color: '#444', fontSize: '14px' }}>›</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedMeal && (
                <MealDetailPanel meal={selectedMeal} onClose={() => setSelectedMeal(null)} onDelete={handleDeleteMeal} />
            )}
        </div>
    )
}