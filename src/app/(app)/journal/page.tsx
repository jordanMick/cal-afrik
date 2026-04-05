'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import type { Meal } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────
const getLast7Days = () =>
    Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
    }).reverse()

const today = () => new Date().toISOString().split('T')[0]

const formatDay = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
}

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const MEAL_TYPE_EMOJIS: Record<string, string> = {
    petit_dejeuner: '🌅',
    dejeuner: '☀️',
    diner: '🌙',
    collation: '🥜',
}

// ─── Composant graphique poids minimaliste ────────────────────
function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
    if (entries.length === 0) return null

    const weights = entries.map(e => e.weight)
    const minW = Math.min(...weights) - 1
    const maxW = Math.max(...weights) + 1
    const range = maxW - minW || 1

    const W = 320
    const H = 100
    const padX = 28
    const padY = 12

    const toX = (i: number) => padX + (i / Math.max(entries.length - 1, 1)) * (W - padX * 2)
    const toY = (w: number) => padY + ((maxW - w) / range) * (H - padY * 2)

    const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.weight), ...e }))
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100px' }}>
            {/* Grille horizontale */}
            {[0, 0.5, 1].map((t, i) => {
                const y = padY + t * (H - padY * 2)
                const val = (maxW - t * range).toFixed(1)
                return (
                    <g key={i}>
                        <line x1={padX} y1={y} x2={W - 8} y2={y} stroke="#2A1F14" strokeWidth="1" />
                        <text x={padX - 4} y={y + 4} textAnchor="end" fill="#444" fontSize="9">{val}</text>
                    </g>
                )
            })}

            {/* Ligne */}
            <path d={path} fill="none" stroke="#C4622D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Points + labels */}
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#C4622D" />
                    {i === points.length - 1 && (
                        <>
                            <rect x={p.x - 18} y={p.y - 22} width="36" height="16" rx="6" fill="#C4622D" />
                            <text x={p.x} y={p.y - 11} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
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

// ─── Modal consigner le poids ────────────────────────────────
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
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60 }} />
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                margin: '0 auto', maxWidth: '480px',
                background: '#1A1108', borderRadius: '24px 24px 0 0',
                border: '1px solid #2A1F14', zIndex: 70,
                padding: '24px 24px 48px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px' }} />
                </div>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', marginBottom: '6px' }}>
                    Consigner mon poids
                </h3>
                <p style={{ color: '#555', fontSize: '13px', marginBottom: '24px' }}>
                    Poids actuel enregistré : {currentWeight} kg
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <input
                        type="number"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        step="0.1"
                        style={{
                            flex: 1, padding: '16px', borderRadius: '12px',
                            background: '#0F0A06', border: '1px solid #333',
                            color: '#fff', fontSize: '24px', fontWeight: '800',
                            textAlign: 'center',
                        }}
                    />
                    <span style={{ color: '#555', fontSize: '18px', fontWeight: '700' }}>kg</span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#2A1F14', border: '1px solid #333', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                        Annuler
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#C4622D', border: 'none', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? 'Enregistrement...' : '✅ Enregistrer'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ─── Panel détail repas (réutilisé du journal) ───────────────
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
                        {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} · {meal.portion_g}g
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

// ─── PAGE RAPPORT ────────────────────────────────────────────
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

    // ─── Chargement initial ───────────────────────────────────
    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Repas des 7 derniers jours
            const startDate = last7[0]
            const endDate = `${todayStr}T23:59:59.999Z`
            const res = await fetch(`/api/meals?date_from=${startDate}&date_to=${todayStr}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setMeals7days(json.data)

            // Entrées de poids depuis user_profiles (poids actuel)
            if (profile?.weight_kg) {
                setWeightEntries([{ date: todayStr, weight: profile.weight_kg }])
            }
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
        setMeals7days(prev => prev.filter(m => m.id !== mealId))
    }

    const handleSaveWeight = async (newWeight: number) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !profile) return

        try {
            // ✅ Route dédiée — met à jour UNIQUEMENT weight_kg en base
            const res = await fetch('/api/user/weight', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ weight_kg: newWeight }),
            })

            const json = await res.json()
            if (!json.success) {
                console.error('❌ Erreur mise à jour poids:', json.error)
                return
            }

            // ✅ Mettre à jour le store local avec le profil retourné par la base
            setProfile({ ...profile, weight_kg: newWeight })

            // ✅ Mettre à jour le graphique
            setWeightEntries(prev => {
                const exists = prev.find(e => e.date === todayStr)
                if (exists) return prev.map(e => e.date === todayStr ? { ...e, weight: newWeight } : e)
                return [...prev, { date: todayStr, weight: newWeight }]
            })
        } catch (err) {
            console.error('❌ handleSaveWeight error:', err)
        }
    }

    // ─── Stats 7 jours ────────────────────────────────────────
    const totalMeals = meals7days.length
    const totalCalories7 = meals7days.reduce((acc, m) => acc + m.calories, 0)
    const avgCaloriesPerDay = totalMeals > 0 ? Math.round(totalCalories7 / 7) : 0

    // Repas par jour pour les coches
    const mealsByDay: Record<string, Meal[]> = {}
    for (const meal of meals7days) {
        const d = meal.logged_at.split('T')[0]
        if (!mealsByDay[d]) mealsByDay[d] = []
        mealsByDay[d].push(meal)
    }

    // Repas d'aujourd'hui
    const todayMeals = mealsByDay[todayStr] || []
    const todayCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0)

    const currentWeight = profile?.weight_kg ?? 0
    const weightMin = weightEntries.length > 0 ? Math.min(...weightEntries.map(e => e.weight)) : currentWeight
    const weightMax = weightEntries.length > 0 ? Math.max(...weightEntries.map(e => e.weight)) : currentWeight

    return (
        <div style={{
            minHeight: '100vh', background: '#0F0A06',
            maxWidth: '480px', margin: '0 auto',
            paddingBottom: '100px', fontFamily: 'system-ui, sans-serif',
        }}>
            {/* ─── HEADER ─── */}
            <div style={{ padding: '52px 24px 20px', borderBottom: '1px solid #2A1F14' }}>
                <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    Rapport
                </h1>
            </div>

            <div style={{ padding: '20px 24px' }}>

                {/* ─── SECTION 1 : REPAS SCANNÉS (7 jours) ─── */}
                <div style={{
                    background: '#1A1108', border: '1px solid #2A1F14',
                    borderRadius: '20px', padding: '20px', marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <p style={{ color: '#777', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            7 derniers jours
                        </p>
                        <span style={{ color: '#C4622D', fontSize: '11px', fontWeight: '600' }}>
                            📸 {totalMeals} repas scannés
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ background: '#0F0A06', borderRadius: '14px', padding: '16px' }}>
                            <p style={{ color: '#C4622D', fontSize: '28px', fontWeight: '800', letterSpacing: '-1px' }}>
                                {Math.round(totalCalories7).toLocaleString()}
                            </p>
                            <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>kcal totales</p>
                        </div>
                        <div style={{ background: '#0F0A06', borderRadius: '14px', padding: '16px' }}>
                            <p style={{ color: '#E9C46A', fontSize: '28px', fontWeight: '800', letterSpacing: '-1px' }}>
                                {avgCaloriesPerDay}
                            </p>
                            <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>kcal/jour moy.</p>
                        </div>
                    </div>

                    {/* Macros moyennes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        {[
                            { label: 'Prot. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.protein_g, 0) / 7) : 0, color: '#52B788', unit: 'g' },
                            { label: 'Gluc. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.carbs_g, 0) / 7) : 0, color: '#E9C46A', unit: 'g' },
                            { label: 'Lip. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.fat_g, 0) / 7) : 0, color: '#E07040', unit: 'g' },
                        ].map(m => (
                            <div key={m.label} style={{ background: '#0F0A06', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                                <p style={{ color: m.color, fontSize: '16px', fontWeight: '800' }}>{m.value}{m.unit}</p>
                                <p style={{ color: '#444', fontSize: '9px', marginTop: '2px' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── SECTION 2 : HISTORIQUE 7 JOURS ─── */}
                <div style={{
                    background: '#1A1108', border: '1px solid #2A1F14',
                    borderRadius: '20px', padding: '20px', marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '800' }}>Historique</p>
                        <button
                            onClick={() => router.push('/historique')}
                            style={{ background: 'none', border: 'none', color: '#C4622D', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Tous les enregistrements →
                        </button>
                    </div>

                    {/* 7 jours avec coches */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                        {last7.map(date => {
                            const dayMeals = mealsByDay[date] || []
                            const hasEaten = dayMeals.length > 0
                            const isToday = date === todayStr
                            const isPast = date < todayStr

                            return (
                                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#444', fontSize: '9px', textTransform: 'uppercase' }}>
                                        {formatDay(date)}
                                    </span>
                                    <div style={{
                                        width: '32px', height: '32px',
                                        borderRadius: '50%',
                                        background: isToday ? '#C4622D' : hasEaten ? 'rgba(196,98,45,0.2)' : '#0F0A06',
                                        border: isToday ? 'none' : hasEaten ? '1px solid #C4622D' : '1px solid #2A1F14',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {hasEaten ? (
                                            <span style={{ color: isToday ? '#fff' : '#C4622D', fontSize: '14px' }}>✓</span>
                                        ) : isPast ? (
                                            <span style={{ color: '#333', fontSize: '10px', fontWeight: '700' }}>
                                                {new Date(date).getDate()}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#fff', fontSize: '10px', fontWeight: '800' }}>
                                                {new Date(date).getDate()}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: hasEaten ? '#C4622D' : '#333', fontSize: '8px', fontWeight: '600' }}>
                                        {hasEaten ? `${dayMeals.length}` : ''}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Jours consécutifs */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2A1F14' }}>
                        <div>
                            <p style={{ color: '#555', fontSize: '11px', marginBottom: '4px' }}>Jours consécutifs</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '16px' }}>🔥</span>
                                <span style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>
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
                            <p style={{ color: '#C4622D', fontSize: '20px', fontWeight: '800' }}>
                                {Math.round(todayCalories)} <span style={{ color: '#444', fontSize: '12px', fontWeight: '400' }}>kcal</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* ─── SECTION 3 : REPAS D'AUJOURD'HUI ─── */}
                {todayMeals.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ color: '#555', fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                            Repas d'aujourd'hui
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {todayMeals.map(meal => (
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
                                            {formatTime(meal.logged_at)} · {meal.protein_g}g prot · {meal.carbs_g}g gluc
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ color: '#C4622D', fontSize: '15px', fontWeight: '800' }}>
                                            {Math.round(meal.calories)}<span style={{ color: '#444', fontSize: '10px' }}> kcal</span>
                                        </p>
                                        {meal.coach_message && <span style={{ fontSize: '12px' }}>🤖</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── SECTION 4 : POIDS ─── */}
                <div style={{
                    background: '#1A1108', border: '1px solid #2A1F14',
                    borderRadius: '20px', padding: '20px', marginBottom: '20px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '800' }}>Poids</p>
                        <button
                            onClick={() => setShowWeightModal(true)}
                            style={{
                                padding: '8px 16px', borderRadius: '20px',
                                background: '#C4622D', border: 'none',
                                color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                            }}
                        >
                            Consigner
                        </button>
                    </div>

                    {/* Stats poids */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ flex: 1, background: '#0F0A06', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#555', fontSize: '10px', marginBottom: '4px' }}>Actuel</p>
                            <p style={{ color: '#fff', fontSize: '22px', fontWeight: '800' }}>{currentWeight} <span style={{ color: '#444', fontSize: '12px' }}>kg</span></p>
                        </div>
                        <div style={{ flex: 1, background: '#0F0A06', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#555', fontSize: '10px', marginBottom: '2px' }}>Le plus lourd</p>
                            <p style={{ color: '#E24B4A', fontSize: '16px', fontWeight: '800' }}>{weightMax} <span style={{ color: '#444', fontSize: '10px' }}>kg</span></p>
                            <p style={{ color: '#555', fontSize: '10px', marginTop: '4px' }}>Le plus léger</p>
                            <p style={{ color: '#52B788', fontSize: '16px', fontWeight: '800' }}>{weightMin} <span style={{ color: '#444', fontSize: '10px' }}>kg</span></p>
                        </div>
                    </div>

                    {/* Graphique */}
                    {weightEntries.length > 0 ? (
                        <div style={{ background: '#0F0A06', borderRadius: '12px', padding: '12px' }}>
                            <WeightChart entries={weightEntries} />
                        </div>
                    ) : (
                        <div style={{ background: '#0F0A06', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                            <p style={{ color: '#333', fontSize: '13px' }}>Aucune donnée de poids</p>
                            <p style={{ color: '#444', fontSize: '11px', marginTop: '4px' }}>Appuie sur "Consigner" pour commencer</p>
                        </div>
                    )}

                    {/* Infos profil */}
                    {profile && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2A1F14', display: 'flex', justifyContent: 'space-around' }}>
                            {[
                                { label: 'Taille', value: profile.height_cm ? `${profile.height_cm} cm` : '—' },
                                { label: 'Objectif', value: profile.calorie_target ? `${profile.calorie_target} kcal` : '—' },
                                { label: 'Objectif', value: profile.goal || '—' },
                            ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <p style={{ color: '#444', fontSize: '10px', marginBottom: '2px' }}>{item.label}</p>
                                    <p style={{ color: '#777', fontSize: '12px', fontWeight: '600' }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* ─── MODAL POIDS ─── */}
            {showWeightModal && (
                <WeightModal
                    currentWeight={currentWeight}
                    onClose={() => setShowWeightModal(false)}
                    onSave={handleSaveWeight}
                />
            )}

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