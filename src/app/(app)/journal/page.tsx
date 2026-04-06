'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import type { Meal } from '@/types'

const getLast7Days = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split('T')[0] }).reverse()
const today = () => new Date().toISOString().split('T')[0]
const formatDay = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const MEAL_TYPE_EMOJIS: Record<string, string> = { petit_dejeuner: '🌅', dejeuner: '☀️', diner: '🌙', collation: '🥜' }

const DAY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#10b981', '#f59e0b']

function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
    if (entries.length === 0) return null
    const weights = entries.map(e => e.weight)
    const minW = Math.min(...weights) - 1, maxW = Math.max(...weights) + 1, range = maxW - minW || 1
    const W = 320, H = 90, padX = 28, padY = 10
    const toX = (i: number) => padX + (i / Math.max(entries.length - 1, 1)) * (W - padX * 2)
    const toY = (w: number) => padY + ((maxW - w) / range) * (H - padY * 2)
    const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.weight), ...e }))
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '90px' }}>
            <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
            </defs>
            {[0, 0.5, 1].map((t, i) => { const y = padY + t * (H - padY * 2); return (<g key={i}><line x1={padX} y1={y} x2={W - 8} y2={y} stroke="#1e1e1e" strokeWidth="1" /><text x={padX - 4} y={y + 4} textAnchor="end" fill="#333" fontSize="9">{(maxW - t * range).toFixed(1)}</text></g>) })}
            <path d={path} fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#6366f1" />
                    {i === points.length - 1 && (<><rect x={p.x - 18} y={p.y - 22} width="36" height="16" rx="6" fill="#6366f1" /><text x={p.x} y={p.y - 11} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">{p.weight}kg</text></>)}
                    <text x={p.x} y={H - 2} textAnchor="middle" fill="#333" fontSize="8">{new Date(p.date).getDate()}</text>
                </g>
            ))}
        </svg>
    )
}

function WeightModal({ currentWeight, onClose, onSave }: { currentWeight: number; onClose: () => void; onSave: (w: number) => Promise<void> }) {
    const [value, setValue] = useState(currentWeight.toString())
    const [saving, setSaving] = useState(false)
    const handleSave = async () => { const num = parseFloat(value); if (isNaN(num) || num < 20 || num > 300) return; setSaving(true); await onSave(num); setSaving(false); onClose() }
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', maxWidth: '480px', background: '#111', borderRadius: '24px 24px 0 0', border: '0.5px solid #222', zIndex: 70, padding: '24px 20px 48px' }}>
                <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', paddingTop: '10px' }}><div style={{ width: '36px', height: '4px', background: '#222', borderRadius: '2px' }} /></div>
                <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: '600', marginBottom: '4px' }}>Consigner mon poids</h3>
                <p style={{ color: '#444', fontSize: '13px', marginBottom: '20px' }}>Poids actuel : {currentWeight} kg</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <input type="number" value={value} onChange={e => setValue(e.target.value)} step="0.1" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#0a0a0a', border: '0.5px solid #2a2a2a', color: '#fff', fontSize: '22px', fontWeight: '600', textAlign: 'center' }} />
                    <span style={{ color: '#444', fontSize: '16px' }}>kg</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: '#1a1a1a', border: '0.5px solid #222', color: '#fff', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: '12px', background: saving ? '#1e1e1e' : 'linear-gradient(135deg, #6366f1, #10b981)', border: 'none', color: saving ? '#444' : '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>{saving ? 'Enregistrement...' : '✅ Enregistrer'}</button>
                </div>
            </div>
        </>
    )
}

function MealDetailPanel({ meal, onClose, onDelete }: { meal: Meal; onClose: () => void; onDelete: (id: string) => Promise<void> }) {
    const [showCoach, setShowCoach] = useState(false)
    const totalKcal = (meal.protein_g * 4) + (meal.carbs_g * 4) + (meal.fat_g * 9)
    const macros = totalKcal === 0 ? { protein: 0, carbs: 0, fat: 0 } : { protein: Math.round((meal.protein_g * 4 / totalKcal) * 100), carbs: Math.round((meal.carbs_g * 4 / totalKcal) * 100), fat: Math.round((meal.fat_g * 9 / totalKcal) * 100) }
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 40 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', maxWidth: '480px', background: '#111', borderRadius: '24px 24px 0 0', border: '0.5px solid #222', zIndex: 50, maxHeight: '90vh', overflowY: 'auto', paddingBottom: '100px' }}>
                <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, #6366f1, #10b981, #f59e0b)' }} />
                <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}><div style={{ width: '36px', height: '4px', background: '#222', borderRadius: '2px' }} /></div>
                {meal.image_url && <div style={{ width: '100%', height: '160px', overflow: 'hidden' }}><img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: '600', flex: 1, marginRight: '12px' }}>{meal.custom_name || 'Repas'}</h2>
                        <span style={{ color: '#444', fontSize: '12px' }}>{formatTime(meal.logged_at)}</span>
                    </div>
                    <p style={{ color: '#444', fontSize: '12px', marginBottom: '14px' }}>{MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} · {meal.portion_g}g</p>
                    <div style={{ background: '#0a0a0a', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '12px', border: '0.5px solid rgba(99,102,241,0.2)' }}>
                        <p style={{ color: '#6366f1', fontSize: '44px', fontWeight: '700', letterSpacing: '-2px' }}>{Math.round(meal.calories)}</p>
                        <p style={{ color: '#444', fontSize: '13px' }}>kilocalories</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        {[{ label: 'Protéines', value: meal.protein_g, color: '#6366f1', pct: macros.protein }, { label: 'Glucides', value: meal.carbs_g, color: '#f59e0b', pct: macros.carbs }, { label: 'Lipides', value: meal.fat_g, color: '#10b981', pct: macros.fat }].map(m => (
                            <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px 8px', textAlign: 'center', border: `0.5px solid ${m.color}20` }}>
                                <p style={{ color: m.color, fontSize: '18px', fontWeight: '600' }}>{m.value}g</p>
                                <p style={{ color: '#444', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                                <p style={{ color: '#222', fontSize: '9px', marginTop: '2px' }}>{m.pct}%</p>
                            </div>
                        ))}
                    </div>
                    {meal.coach_message && (
                        <div style={{ marginBottom: '14px' }}>
                            <button onClick={() => setShowCoach(!showCoach)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'transparent', border: '0.5px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontWeight: '500', fontSize: '13px', cursor: 'pointer', textAlign: 'left', marginBottom: showCoach ? '8px' : '0' }}>
                                {showCoach ? '🤖 Conseil du coach' : '💡 Voir le conseil du coach →'}
                            </button>
                            {showCoach && <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: '10px', padding: '12px', border: '0.5px solid rgba(245,158,11,0.2)' }}><p style={{ color: '#ccc', fontSize: '12px', lineHeight: '1.6' }}>{meal.coach_message}</p></div>}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: '#1a1a1a', border: '0.5px solid #222', color: '#fff', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}>← Retour</button>
                        <button onClick={async () => { if (confirm('Supprimer ce repas ?')) { await onDelete(meal.id); onClose() } }} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: '0.5px solid rgba(239,68,68,0.3)', color: '#f87171', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}>🗑️ Supprimer</button>
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
            const res = await fetch(`/api/meals?date_from=${last7[0]}&date_to=${todayStr}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
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
            const res = await fetch('/api/user/weight', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ weight_kg: newWeight }) })
            const json = await res.json()
            if (!json.success) return
            setProfile({ ...profile, weight_kg: newWeight })
            setWeightEntries(prev => { const exists = prev.find(e => e.date === todayStr); if (exists) return prev.map(e => e.date === todayStr ? { ...e, weight: newWeight } : e); return [...prev, { date: todayStr, weight: newWeight }] })
        } catch (err) { console.error(err) }
    }

    const totalMeals = meals7days.length
    const totalCalories7 = meals7days.reduce((acc, m) => acc + m.calories, 0)
    const avgCaloriesPerDay = totalMeals > 0 ? Math.round(totalCalories7 / 7) : 0

    const mealsByDay: Record<string, Meal[]> = {}
    for (const meal of meals7days) { const d = meal.logged_at.split('T')[0]; if (!mealsByDay[d]) mealsByDay[d] = []; mealsByDay[d].push(meal) }

    const todayMeals = mealsByDay[todayStr] || []
    const todayCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0)
    const currentWeight = profile?.weight_kg ?? 0
    const weightMin = weightEntries.length > 0 ? Math.min(...weightEntries.map(e => e.weight)) : currentWeight
    const weightMax = weightEntries.length > 0 ? Math.max(...weightEntries.map(e => e.weight)) : currentWeight

    const card: React.CSSProperties = { background: '#141414', border: '0.5px solid #222', borderRadius: '18px', padding: '18px', marginBottom: '12px', position: 'relative', overflow: 'hidden' }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'fixed', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: '52px 20px 20px', borderBottom: '0.5px solid #1a1a1a' }}>
                <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '600' }}>Rapport</h1>
            </div>

            <div style={{ padding: '18px 20px' }}>

                {/* 7 JOURS */}
                <div style={card}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #10b981, #f59e0b, #ec4899)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: '#555', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>7 derniers jours</p>
                        <span style={{ color: '#6366f1', fontSize: '11px', background: 'rgba(99,102,241,0.1)', padding: '3px 10px', borderRadius: '20px', border: '0.5px solid rgba(99,102,241,0.3)' }}>📸 {totalMeals} repas</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px', border: '0.5px solid rgba(99,102,241,0.15)' }}>
                            <p style={{ color: '#6366f1', fontSize: '26px', fontWeight: '700', letterSpacing: '-1px' }}>{Math.round(totalCalories7).toLocaleString()}</p>
                            <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>kcal totales</p>
                        </div>
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px', border: '0.5px solid rgba(16,185,129,0.15)' }}>
                            <p style={{ color: '#10b981', fontSize: '26px', fontWeight: '700', letterSpacing: '-1px' }}>{avgCaloriesPerDay}</p>
                            <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>kcal/jour moy.</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        {[
                            { label: 'Prot. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.protein_g, 0) / 7) : 0, color: '#6366f1' },
                            { label: 'Gluc. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.carbs_g, 0) / 7) : 0, color: '#f59e0b' },
                            { label: 'Lip. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.fat_g, 0) / 7) : 0, color: '#10b981' },
                        ].map(m => (
                            <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px', textAlign: 'center', border: `0.5px solid ${m.color}15` }}>
                                <p style={{ color: m.color, fontSize: '16px', fontWeight: '600' }}>{m.value}g</p>
                                <p style={{ color: '#333', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* HISTORIQUE 7 JOURS */}
                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600' }}>Historique</p>
                        <button onClick={() => router.push('/historique')} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer' }}>Tous →</button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', marginBottom: '14px' }}>
                        {last7.map((date, idx) => {
                            const dayMeals = mealsByDay[date] || []
                            const hasEaten = dayMeals.length > 0
                            const isToday = date === todayStr
                            const dotColor = DAY_COLORS[idx]
                            return (
                                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#333', fontSize: '9px', textTransform: 'uppercase' }}>{formatDay(date)}</span>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isToday ? dotColor : hasEaten ? `${dotColor}20` : '#111', border: isToday ? 'none' : hasEaten ? `1px solid ${dotColor}60` : '0.5px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {hasEaten ? <span style={{ color: isToday ? '#fff' : dotColor, fontSize: '12px' }}>✓</span> : <span style={{ color: '#222', fontSize: '10px' }}>{new Date(date).getDate()}</span>}
                                    </div>
                                    <span style={{ color: hasEaten ? dotColor : '#1e1e1e', fontSize: '8px', fontWeight: '600' }}>{hasEaten ? `${dayMeals.length}` : ''}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '14px', borderTop: '0.5px solid #1a1a1a' }}>
                        <div>
                            <p style={{ color: '#444', fontSize: '11px', marginBottom: '4px' }}>Jours consécutifs</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>🔥</span>
                                <span style={{ color: '#fff', fontSize: '22px', fontWeight: '700' }}>
                                    {(() => { let streak = 0; for (let i = last7.length - 1; i >= 0; i--) { if ((mealsByDay[last7[i]] || []).length > 0) streak++; else break }; return streak })()}
                                </span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#444', fontSize: '11px', marginBottom: '4px' }}>Aujourd'hui</p>
                            <p style={{ color: '#10b981', fontSize: '22px', fontWeight: '700' }}>{Math.round(todayCalories)} <span style={{ color: '#333', fontSize: '12px', fontWeight: '400' }}>kcal</span></p>
                        </div>
                    </div>
                </div>

                {/* REPAS D'AUJOURD'HUI */}
                {todayMeals.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <p style={{ color: '#444', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Repas d'aujourd'hui</p>
                        {todayMeals.map((meal, idx) => {
                            const dotColor = DAY_COLORS[idx % DAY_COLORS.length]
                            return (
                                <div key={meal.id} onClick={() => setSelectedMeal(meal)} style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '8px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: dotColor }} />
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', background: '#222', flexShrink: 0, marginLeft: '8px' }}>
                                        {meal.image_url ? <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'}</div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meal.custom_name || 'Repas'}</p>
                                        <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>{formatTime(meal.logged_at)} · {meal.protein_g}g prot · {meal.carbs_g}g gluc</p>
                                    </div>
                                    <p style={{ color: dotColor, fontSize: '14px', fontWeight: '600', flexShrink: 0 }}>{Math.round(meal.calories)}<span style={{ color: '#333', fontSize: '10px' }}> kcal</span></p>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* POIDS */}
                <div style={card}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #ec4899)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600' }}>Poids</p>
                        <button onClick={() => setShowWeightModal(true)} style={{ padding: '7px 16px', borderRadius: '20px', background: 'linear-gradient(135deg, #6366f1, #ec4899)', border: 'none', color: '#fff', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Consigner</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        <div style={{ flex: 1, background: '#0a0a0a', borderRadius: '12px', padding: '14px', border: '0.5px solid rgba(99,102,241,0.2)' }}>
                            <p style={{ color: '#444', fontSize: '10px', marginBottom: '4px' }}>Actuel</p>
                            <p style={{ color: '#6366f1', fontSize: '24px', fontWeight: '700' }}>{currentWeight} <span style={{ color: '#333', fontSize: '12px' }}>kg</span></p>
                        </div>
                        <div style={{ flex: 1, background: '#0a0a0a', borderRadius: '12px', padding: '14px' }}>
                            <p style={{ color: '#444', fontSize: '10px', marginBottom: '2px' }}>Le plus lourd</p>
                            <p style={{ color: '#f87171', fontSize: '15px', fontWeight: '600' }}>{weightMax} kg</p>
                            <p style={{ color: '#444', fontSize: '10px', marginTop: '6px' }}>Le plus léger</p>
                            <p style={{ color: '#10b981', fontSize: '15px', fontWeight: '600' }}>{weightMin} kg</p>
                        </div>
                    </div>
                    {weightEntries.length > 0 ? (
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '12px', border: '0.5px solid rgba(99,102,241,0.1)' }}>
                            <WeightChart entries={weightEntries} />
                        </div>
                    ) : (
                        <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                            <p style={{ color: '#222', fontSize: '13px' }}>Aucune donnée de poids</p>
                        </div>
                    )}
                    {profile && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '0.5px solid #1a1a1a', display: 'flex', justifyContent: 'space-around' }}>
                            {[
                                { label: 'Taille', value: profile.height_cm ? `${profile.height_cm} cm` : '—' },
                                { label: 'Objectif kcal', value: profile.calorie_target ? `${profile.calorie_target}` : '—' },
                                { label: 'But', value: profile.goal || '—' },
                            ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <p style={{ color: '#333', fontSize: '10px', marginBottom: '2px' }}>{item.label}</p>
                                    <p style={{ color: '#666', fontSize: '12px', fontWeight: '500' }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showWeightModal && <WeightModal currentWeight={currentWeight} onClose={() => setShowWeightModal(false)} onSave={handleSaveWeight} />}
            {selectedMeal && <MealDetailPanel meal={selectedMeal} onClose={() => setSelectedMeal(null)} onDelete={handleDeleteMeal} />}
        </div>
    )
}