'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import type { Meal } from '@/types'

const getLast7Days = () =>
    Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
    }).reverse()

const today = () => new Date().toISOString().split('T')[0]

const formatDay = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const MEAL_TYPE_EMOJIS: Record<string, string> = {
    petit_dejeuner: '🌅', dejeuner: '☀️', diner: '🌙', collation: '🥜',
}

const card: React.CSSProperties = {
    background: '#161616',
    border: '0.5px solid #2a2a2a',
    borderRadius: '18px',
    padding: '18px',
    marginBottom: '12px',
}

function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
    if (entries.length === 0) return null
    const weights = entries.map(e => e.weight)
    const minW = Math.min(...weights) - 1
    const maxW = Math.max(...weights) + 1
    const range = maxW - minW || 1
    const W = 320, H = 90, padX = 28, padY = 10
    const toX = (i: number) => padX + (i / Math.max(entries.length - 1, 1)) * (W - padX * 2)
    const toY = (w: number) => padY + ((maxW - w) / range) * (H - padY * 2)
    const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.weight), ...e }))
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '90px' }}>
            {[0, 0.5, 1].map((t, i) => {
                const y = padY + t * (H - padY * 2)
                const val = (maxW - t * range).toFixed(1)
                return (
                    <g key={i}>
                        <line x1={padX} y1={y} x2={W - 8} y2={y} stroke="#222" strokeWidth="1" />
                        <text x={padX - 4} y={y + 4} textAnchor="end" fill="#444" fontSize="9">{val}</text>
                    </g>
                )
            })}
            <path d={path} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" />
                    {i === points.length - 1 && (
                        <>
                            <rect x={p.x - 16} y={p.y - 20} width="32" height="14" rx="4" fill="#fff" />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#000" fontSize="8" fontWeight="500">
                                {p.weight}kg
                            </text>
                        </>
                    )}
                    <text x={p.x} y={H - 2} textAnchor="middle" fill="#444" fontSize="8">
                        {new Date(p.date).getDate()}
                    </text>
                </g>
            ))}
        </svg>
    )
}

function WeightModal({ currentWeight, onClose, onSave }: {
    currentWeight: number
    onClose: () => void
    onSave: (w: number) => Promise<void>
}) {
    const [value, setValue] = useState(currentWeight.toString())
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 20 || num > 300) return
        setSaving(true)
        await onSave(num)
        setSaving(false)
        onClose()
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60 }} />
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                margin: '0 auto', maxWidth: '480px',
                background: '#111', borderRadius: '20px 20px 0 0',
                border: '0.5px solid #2a2a2a', zIndex: 70,
                padding: '24px 20px 48px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '4px', background: '#333', borderRadius: '2px' }} />
                </div>
                <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: '500', marginBottom: '4px' }}>Consigner mon poids</h3>
                <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>Poids actuel : {currentWeight} kg</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <input type="number" value={value} onChange={e => setValue(e.target.value)} step="0.1" style={{
                        flex: 1, padding: '14px', borderRadius: '12px',
                        background: '#0a0a0a', border: '0.5px solid #333',
                        color: '#fff', fontSize: '22px', fontWeight: '500', textAlign: 'center',
                    }} />
                    <span style={{ color: '#555', fontSize: '16px' }}>kg</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '13px', borderRadius: '12px',
                        background: '#1a1a1a', border: '0.5px solid #333',
                        color: '#fff', fontWeight: '500', fontSize: '14px', cursor: 'pointer'
                    }}>Annuler</button>
                    <button onClick={handleSave} disabled={saving} style={{
                        flex: 2, padding: '13px', borderRadius: '12px',
                        background: '#fff', border: 'none',
                        color: '#000', fontWeight: '500', fontSize: '14px',
                        cursor: 'pointer', opacity: saving ? 0.7 : 1
                    }}>{saving ? 'Enregistrement...' : '✅ Enregistrer'}</button>
                </div>
            </div>
        </>
    )
}

function MealDetailPanel({ meal, onClose, onDelete }: {
    meal: Meal; onClose: () => void; onDelete: (id: string) => Promise<void>
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
                    <div style={{ width: '100%', height: '160px', overflow: 'hidden' }}>
                        <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                )}
                <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: '500', flex: 1, marginRight: '12px' }}>
                            {meal.custom_name || 'Repas'}
                        </h2>
                        <span style={{ color: '#555', fontSize: '12px' }}>{formatTime(meal.logged_at)}</span>
                    </div>
                    <p style={{ color: '#555', fontSize: '12px', marginBottom: '14px' }}>
                        {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} · {meal.portion_g}g
                    </p>
                    <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px', textAlign: 'center', marginBottom: '12px' }}>
                        <p style={{ color: '#fff', fontSize: '40px', fontWeight: '500', letterSpacing: '-2px' }}>{Math.round(meal.calories)}</p>
                        <p style={{ color: '#555', fontSize: '13px' }}>kilocalories</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
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
                    {meal.coach_message && (
                        <div style={{ marginBottom: '14px' }}>
                            <button onClick={() => setShowCoach(!showCoach)} style={{
                                width: '100%', padding: '10px 12px', borderRadius: '10px',
                                background: 'transparent', border: '0.5px solid #333',
                                color: '#888', fontWeight: '500', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                                marginBottom: showCoach ? '8px' : '0'
                            }}>
                                {showCoach ? '🤖 Conseil du coach' : '💡 Voir le conseil du coach →'}
                            </button>
                            {showCoach && (
                                <div style={{ background: '#0a0a0a', borderRadius: '10px', padding: '12px', border: '0.5px solid #2a2a2a' }}>
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

export default function RapportPage() {
    const router = useRouter()
    const { profile, setProfile } = useAppStore()

    const [meals7days, setMeals7days] = useState<Meal[]>([])
    const [weightEntries, setWeightEntries] = useState<{ date: string; weight: number }[]>([])
    const [showWeightModal, setShowWeightModal] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const last7 = getLast7Days()
    const todayStr = today()

    useEffect(() => { fetchAll() }, [])

    const fetchAll = async () => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch(`/api/meals?date_from=${last7[0]}&date_to=${todayStr}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setMeals7days(json.data)
            if (profile?.weight_kg) setWeightEntries([{ date: todayStr, weight: profile.weight_kg }])
        } catch (err) { console.error(err) }
        finally { setIsLoading(false) }
    }

    const handleDeleteMeal = async (mealId: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
        setMeals7days(prev => prev.filter(m => m.id !== mealId))
    }

    const handleSaveWeight = async (newWeight: number) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !profile) return
        try {
            const res = await fetch('/api/user/weight', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ weight_kg: newWeight }),
            })
            const json = await res.json()
            if (!json.success) return
            setProfile({ ...profile, weight_kg: newWeight })
            setWeightEntries(prev => {
                const exists = prev.find(e => e.date === todayStr)
                if (exists) return prev.map(e => e.date === todayStr ? { ...e, weight: newWeight } : e)
                return [...prev, { date: todayStr, weight: newWeight }]
            })
        } catch (err) { console.error(err) }
    }

    const totalMeals = meals7days.length
    const totalCalories7 = meals7days.reduce((acc, m) => acc + m.calories, 0)
    const avgCaloriesPerDay = totalMeals > 0 ? Math.round(totalCalories7 / 7) : 0

    const mealsByDay: Record<string, Meal[]> = {}
    for (const meal of meals7days) {
        const d = meal.logged_at.split('T')[0]
        if (!mealsByDay[d]) mealsByDay[d] = []
        mealsByDay[d].push(meal)
    }

    const todayMeals = mealsByDay[todayStr] || []
    const todayCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0)
    const currentWeight = profile?.weight_kg ?? 0
    const weightMin = weightEntries.length > 0 ? Math.min(...weightEntries.map(e => e.weight)) : currentWeight
    const weightMax = weightEntries.length > 0 ? Math.max(...weightEntries.map(e => e.weight)) : currentWeight

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif' }}>

            <div style={{ padding: '52px 20px 20px', borderBottom: '0.5px solid #1e1e1e' }}>
                <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '500' }}>Rapport</h1>
            </div>

            <div style={{ padding: '18px 20px' }}>

                {/* 7 JOURS */}
                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: '#555', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase' }}>7 derniers jours</p>
                        <span style={{ color: '#666', fontSize: '11px' }}>📸 {totalMeals} repas</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#fff', fontSize: '24px', fontWeight: '500', letterSpacing: '-1px' }}>
                                {Math.round(totalCalories7).toLocaleString()}
                            </p>
                            <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>kcal totales</p>
                        </div>
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#fff', fontSize: '24px', fontWeight: '500', letterSpacing: '-1px' }}>{avgCaloriesPerDay}</p>
                            <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>kcal/jour moy.</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        {[
                            { label: 'Prot. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.protein_g, 0) / 7) : 0 },
                            { label: 'Gluc. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.carbs_g, 0) / 7) : 0 },
                            { label: 'Lip. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.fat_g, 0) / 7) : 0 },
                        ].map(m => (
                            <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{m.value}g</p>
                                <p style={{ color: '#444', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* HISTORIQUE 7 JOURS */}
                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>Historique</p>
                        <button onClick={() => router.push('/historique')} style={{ background: 'none', border: 'none', color: '#666', fontSize: '12px', cursor: 'pointer' }}>
                            Tous les enregistrements →
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', marginBottom: '14px' }}>
                        {last7.map(date => {
                            const dayMeals = mealsByDay[date] || []
                            const hasEaten = dayMeals.length > 0
                            const isToday = date === todayStr
                            const isPast = date < todayStr
                            return (
                                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#444', fontSize: '9px', textTransform: 'uppercase' }}>{formatDay(date)}</span>
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '50%',
                                        background: isToday ? '#fff' : hasEaten ? 'rgba(255,255,255,0.1)' : '#111',
                                        border: isToday ? 'none' : hasEaten ? '0.5px solid #fff' : '0.5px solid #222',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {hasEaten
                                            ? <span style={{ color: isToday ? '#000' : '#fff', fontSize: '12px' }}>✓</span>
                                            : <span style={{ color: '#333', fontSize: '10px' }}>{new Date(date).getDate()}</span>
                                        }
                                    </div>
                                    <span style={{ color: hasEaten ? '#666' : '#2a2a2a', fontSize: '8px' }}>
                                        {hasEaten ? `${dayMeals.length}` : ''}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '14px', borderTop: '0.5px solid #222' }}>
                        <div>
                            <p style={{ color: '#555', fontSize: '11px', marginBottom: '4px' }}>Jours consécutifs</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>🔥</span>
                                <span style={{ color: '#fff', fontSize: '20px', fontWeight: '500' }}>
                                    {(() => {
                                        let streak = 0
                                        for (let i = last7.length - 1; i >= 0; i--) {
                                            if ((mealsByDay[last7[i]] || []).length > 0) streak++
                                            else break
                                        }
                                        return streak
                                    })()}
                                </span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#555', fontSize: '11px', marginBottom: '4px' }}>Aujourd'hui</p>
                            <p style={{ color: '#fff', fontSize: '20px', fontWeight: '500' }}>
                                {Math.round(todayCalories)} <span style={{ color: '#444', fontSize: '12px', fontWeight: '400' }}>kcal</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* REPAS D'AUJOURD'HUI */}
                {todayMeals.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <p style={{ color: '#555', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                            Repas d'aujourd'hui
                        </p>
                        {todayMeals.map(meal => (
                            <div key={meal.id} onClick={() => setSelectedMeal(meal)} style={{
                                background: '#161616', border: '0.5px solid #2a2a2a',
                                borderRadius: '14px', padding: '12px',
                                display: 'flex', alignItems: 'center', gap: '10px',
                                cursor: 'pointer', marginBottom: '8px'
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
                                        {Math.round(meal.calories)}<span style={{ color: '#444', fontSize: '10px' }}> kcal</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* POIDS */}
                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>Poids</p>
                        <button onClick={() => setShowWeightModal(true)} style={{
                            padding: '7px 16px', borderRadius: '20px',
                            background: '#fff', border: 'none',
                            color: '#000', fontWeight: '500', fontSize: '12px', cursor: 'pointer',
                        }}>Consigner</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        <div style={{ flex: 1, background: '#0a0a0a', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#555', fontSize: '10px', marginBottom: '4px' }}>Actuel</p>
                            <p style={{ color: '#fff', fontSize: '22px', fontWeight: '500' }}>{currentWeight} <span style={{ color: '#444', fontSize: '12px' }}>kg</span></p>
                        </div>
                        <div style={{ flex: 1, background: '#0a0a0a', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#555', fontSize: '10px', marginBottom: '2px' }}>Le plus lourd</p>
                            <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{weightMax} kg</p>
                            <p style={{ color: '#555', fontSize: '10px', marginTop: '6px' }}>Le plus léger</p>
                            <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{weightMin} kg</p>
                        </div>
                    </div>
                    {weightEntries.length > 0 ? (
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '12px' }}>
                            <WeightChart entries={weightEntries} />
                        </div>
                    ) : (
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                            <p style={{ color: '#333', fontSize: '13px' }}>Aucune donnée de poids</p>
                            <p style={{ color: '#2a2a2a', fontSize: '11px', marginTop: '4px' }}>Appuie sur "Consigner" pour commencer</p>
                        </div>
                    )}
                    {profile && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '0.5px solid #222', display: 'flex', justifyContent: 'space-around' }}>
                            {[
                                { label: 'Taille', value: profile.height_cm ? `${profile.height_cm} cm` : '—' },
                                { label: 'Objectif kcal', value: profile.calorie_target ? `${profile.calorie_target}` : '—' },
                                { label: 'Objectif', value: profile.goal || '—' },
                            ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <p style={{ color: '#444', fontSize: '10px', marginBottom: '2px' }}>{item.label}</p>
                                    <p style={{ color: '#666', fontSize: '12px', fontWeight: '500' }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showWeightModal && (
                <WeightModal currentWeight={currentWeight} onClose={() => setShowWeightModal(false)} onSave={handleSaveWeight} />
            )}
            {selectedMeal && (
                <MealDetailPanel meal={selectedMeal} onClose={() => setSelectedMeal(null)} onDelete={handleDeleteMeal} />
            )}
        </div>
    )
}