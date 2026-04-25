'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Calendar, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'
import type { Meal } from '@/types'

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const MEAL_TYPE_EMOJIS: Record<string, string> = {
    petit_dejeuner: '🌅', dejeuner: '☀️', diner: '🌙', collation: '🥜',
}
const MEAL_TYPE_LABELS: Record<string, string> = {
    petit_dejeuner: 'Petit-déjeuner', dejeuner: 'Déjeuner', diner: 'Dîner', collation: 'Collation',
}
const GRADIENT = 'linear-gradient(90deg, var(--accent), var(--success))'

const DOT_COLORS = ['var(--accent)', 'var(--success)', 'var(--warning)', '#ec4899']
const toLocalDateString = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function MealDetailPanel({ meal, onClose, onDelete, onImageUpdate }: { meal: Meal; onClose: () => void; onDelete: (id: string) => Promise<void>; onImageUpdate?: (id: string, url: string) => void }) {
    const [showCoach, setShowCoach] = useState(false)
    const [imageUploading, setImageUploading] = useState(false)
    const [localImageUrl, setLocalImageUrl] = useState(meal.image_url)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handlePhotoChange = async (file: File) => {
        if (!file) return
        setImageUploading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const ext = file.name.split('.').pop() || 'jpg'
            const fileName = `${session.user.id}/${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage.from('meal-images').upload(fileName, file, { upsert: true })
            if (upErr) throw upErr

            const { data: { publicUrl } } = supabase.storage.from('meal-images').getPublicUrl(fileName)

            const res = await fetch('/api/meals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ id: meal.id, image_url: publicUrl })
            })
            const json = await res.json()
            if (json.success) {
                setLocalImageUrl(publicUrl)
                onImageUpdate?.(meal.id, publicUrl)
            }
        } catch (err) {
            console.error('Photo upload error:', err)
        } finally {
            setImageUploading(false)
        }
    }
    const totalKcal = (meal.protein_g * 4) + (meal.carbs_g * 4) + (meal.fat_g * 9)
    const macros = totalKcal === 0 ? { protein: 0, carbs: 0, fat: 0 } : {
        protein: Math.round((meal.protein_g * 4 / totalKcal) * 100),
        carbs: Math.round((meal.carbs_g * 4 / totalKcal) * 100),
        fat: Math.round((meal.fat_g * 9 / totalKcal) * 100),
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.6)', backdropFilter: 'blur(10px)', zIndex: 40 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', maxWidth: '480px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0', border: '0.5px solid var(--border-color)', zIndex: 50, maxHeight: '90vh', overflowY: 'auto', paddingBottom: '100px', boxShadow: '0 -10px 40px rgba(var(--bg-primary-rgb),0.2)' }}>
                <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, var(--accent), var(--success), var(--warning))' }} />
                <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}>
                    <div style={{ width: '36px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }} />
                </div>
                <div style={{ width: '100%', height: '180px', overflow: 'hidden', position: 'relative', background: 'var(--bg-tertiary)', display: localImageUrl ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {localImageUrl
                        ? <img src={localImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '48px' }}>🍽️</span>
                    }
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoChange(f) }} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageUploading}
                        style={{ position: 'absolute', bottom: '10px', right: '10px', padding: '7px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {imageUploading ? '⏳' : '📷'} {imageUploading ? 'Envoi...' : 'Changer'}
                    </button>
                </div>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', flex: 1, marginRight: '12px' }}>{meal.custom_name || 'Repas'}</h2>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{formatTime(meal.logged_at)}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>{MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} {MEAL_TYPE_LABELS[meal.meal_type] || ''} · {meal.portion_g}g</p>

                    <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '12px', border: '0.5px solid rgba(var(--accent-rgb), 0.2)' }}>
                        <p style={{ color: 'var(--accent)', fontSize: '44px', fontWeight: '700', letterSpacing: '-2px' }}>{Math.round(meal.calories)}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>kilocalories</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        {[
                            { label: 'Protéines', value: meal.protein_g, color: 'var(--success)', pct: macros.protein },
                            { label: 'Glucides', value: meal.carbs_g, color: 'var(--accent)', pct: macros.carbs },
                            { label: 'Lipides', value: meal.fat_g, color: 'var(--warning)', pct: macros.fat },
                        ].map(m => (
                            <div key={m.label} style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center', border: `0.5px solid ${m.color}20` }}>
                                <p style={{ color: m.color, fontSize: '18px', fontWeight: '600' }}>{m.value}g</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>{m.pct}%</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', height: '4px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
                            <div style={{ width: `${macros.protein}%`, background: 'var(--success)', borderRadius: '4px 0 0 4px' }} />
                            <div style={{ width: `${macros.carbs}%`, background: 'var(--accent)' }} />
                            <div style={{ width: `${macros.fat}%`, background: 'var(--warning)', borderRadius: '0 4px 4px 0' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ color: 'var(--success)', fontSize: '9px' }}>Prot. {macros.protein}%</span>
                            <span style={{ color: 'var(--accent)', fontSize: '9px' }}>Gluc. {macros.carbs}%</span>
                            <span style={{ color: 'var(--warning)', fontSize: '9px' }}>Lip. {macros.fat}%</span>
                        </div>
                    </div>

                    {meal.coach_message && (
                        <div style={{ marginBottom: '14px' }}>
                            <button onClick={() => setShowCoach(!showCoach)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'transparent', border: '0.5px solid rgba(var(--warning-rgb), 0.3)', color: 'var(--warning)', fontWeight: '500', fontSize: '13px', cursor: 'pointer', textAlign: 'left', marginBottom: showCoach ? '8px' : '0' }}>
                                {showCoach ? '💡 Conseil du coach' : '💡 Voir le conseil du coach →'}
                            </button>
                            {showCoach && <div style={{ background: 'rgba(var(--warning-rgb), 0.06)', borderRadius: '10px', padding: '14px', border: '0.5px solid rgba(var(--warning-rgb), 0.2)' }}><p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6' }}>{meal.coach_message}</p></div>}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}>← Retour</button>
                        <button onClick={async () => { if (confirm('Supprimer ce repas ?')) { await onDelete(meal.id); onClose() } }} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: '0.5px solid var(--danger)', color: 'var(--danger)', fontWeight: '500', fontSize: '13px', cursor: 'pointer', opacity: 0.8 }}>🗑️ Supprimer</button>
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
    const [selectedDate, setSelectedDate] = useState<string | null>(toLocalDateString(now))
    const [mealsForDate, setMealsForDate] = useState<Meal[]>([])
    const [daysWithMeals, setDaysWithMeals] = useState<Set<string>>(new Set())
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
    const { profile } = useAppStore()
    const effectiveTier = getEffectiveTier(profile)
    const [isLoading, setIsLoading] = useState(false)

    const limitDate = (() => {
        const d = new Date()
        if (effectiveTier === 'free') d.setDate(d.getDate() - 7)
        else if (effectiveTier === 'pro') d.setMonth(d.getMonth() - 6)
        else return '0000-00-00'
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()

    useEffect(() => { fetchMonthDays() }, [year, month])
    useEffect(() => { if (selectedDate) fetchMealsForDate(selectedDate) }, [selectedDate])

    const fetchMonthDays = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const lastDay = toLocalDateString(new Date(year, month + 1, 0))
            const tzOffset = new Date().getTimezoneOffset()
            const res = await fetch(`/api/meals?date_from=${firstDay}&date_to=${lastDay}&tz_offset_min=${tzOffset}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
            const json = await res.json()
            if (json.success) setDaysWithMeals(new Set<string>((json.data as Meal[]).map(m => m.logged_at.split('T')[0])))
        } catch (err) { console.error(err) }
    }

    const fetchMealsForDate = async (date: string) => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const tzOffset = new Date().getTimezoneOffset()
            const res = await fetch(`/api/meals?date=${date}&tz_offset_min=${tzOffset}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
            const json = await res.json()
            if (json.success) setMealsForDate(json.data)
        } catch (err) { console.error(err) }
        finally { setIsLoading(false) }
    }

    const handleDeleteMeal = async (mealId: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
        setMealsForDate(prev => prev.filter(m => m.id !== mealId))
        if (mealsForDate.length <= 1 && selectedDate) setDaysWithMeals(prev => { const s = new Set(prev); s.delete(selectedDate); return s })
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const todayStr = toLocalDateString(now)

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

    const cells: (number | null)[] = [...Array(firstDayOfMonth).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
    while (cells.length % 7 !== 0) cells.push(null)

    const selectedDayCalories = mealsForDate.reduce((acc, m) => acc + m.calories, 0)

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

            <div style={{ position: 'fixed', top: '-60px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* HEADER */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Historique</h1>
            </div>

            <div style={{ padding: '20px' }}>

                {/* CALENDRIER */}
                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '20px', padding: '18px', marginBottom: '18px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--accent), var(--success), var(--warning), #ec4899)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <button onClick={prevMonth} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '50%', width: '30px', height: '30px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600' }}>{year} / {String(month + 1).padStart(2, '0')}</p>
                        <button onClick={nextMonth} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '50%', width: '30px', height: '30px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
                        {DAYS_FR.map(d => <div key={d} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px', fontWeight: '600', padding: '4px 0' }}>{d}</div>)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                        {cells.map((day, i) => {
                            if (day === null) return <div key={`e-${i}`} />
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const isToday = dateStr === todayStr
                            const isSelected = dateStr === selectedDate
                            const hasMeals = daysWithMeals.has(dateStr)
                            const isFuture = dateStr > todayStr
                            const isLocked = dateStr < limitDate && !isFuture

                            return (
                                <button key={day} 
                                    onClick={() => {
                                        if (isFuture) return
                                        if (isLocked) {
                                            if (confirm(`Cette date est verrouillée. Passez au plan supérieur pour voir votre historique complet ?`)) {
                                                router.push('/upgrade')
                                            }
                                            return
                                        }
                                        setSelectedDate(dateStr)
                                    }}
                                    style={{
                                        position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '50%',
                                        background: isSelected ? 'linear-gradient(135deg, var(--accent), var(--success))' : isToday ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
                                        border: isToday && !isSelected ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid transparent',
                                        color: isFuture || isLocked ? 'var(--text-muted)' : isSelected ? '#fff' : 'var(--text-secondary)',
                                        fontSize: '13px', fontWeight: isSelected || isToday ? '700' : '400',
                                        cursor: isFuture ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isFuture ? 0.3 : 1
                                    }}>
                                    {day}
                                    {isLocked && !isSelected && (
                                        <span style={{ position: 'absolute', top: '-1px', right: '-1px', fontSize: '8px' }}>🔒</span>
                                    )}
                                    {hasMeals && !isSelected && !isLocked && <div style={{ position: 'absolute', bottom: '6px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }} />}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* JOUR SÉLECTIONNÉ */}
                {selectedDate && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>
                                {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            {mealsForDate.length > 0 && <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>{Math.round(selectedDayCalories)} kcal</span>}
                        </div>

                        {isLoading ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Chargement...</div>
                        ) : (selectedDate && selectedDate < limitDate) ? (
                            <div style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.05), rgba(16,185,129,0.05))', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '32px' }}>🔒</div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>Historique limité</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', maxWidth: '240px', margin: 0 }}>
                                    Votre plan <strong>{effectiveTier.toUpperCase()}</strong> permet de voir les {effectiveTier === 'free' ? '7 derniers jours' : '6 derniers mois'}.
                                </p>
                                <button 
                                    onClick={() => router.push('/upgrade')}
                                    style={{ marginTop: '5px', padding: '10px 20px', borderRadius: '10px', background: GRADIENT, color: '#fff', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    Passer au plan Pro
                                </button>
                            </div>
                        ) : mealsForDate.length === 0 ? (
                            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
                                <p style={{ fontSize: '24px', marginBottom: '8px' }}>📋</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Aucun repas ce jour</p>
                            </div>
                        ) : (
                            <div>
                                {/* macros */}
                                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '14px', padding: '12px', marginBottom: '8px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                        {[
                                            { label: 'Protéines', value: Math.round(mealsForDate.reduce((a, m) => a + m.protein_g, 0)), color: 'var(--success)' },
                                            { label: 'Glucides', value: Math.round(mealsForDate.reduce((a, m) => a + m.carbs_g, 0)), color: 'var(--accent)' },
                                            { label: 'Lipides', value: Math.round(mealsForDate.reduce((a, m) => a + m.fat_g, 0)), color: 'var(--warning)' },
                                        ].map(m => (
                                            <div key={m.label} style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: `0.5px solid ${m.color}20` }}>
                                                <p style={{ color: m.color, fontSize: '15px', fontWeight: '600' }}>{m.value}g</p>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {mealsForDate.map((meal, idx) => {
                                    const dotColor = DOT_COLORS[idx % DOT_COLORS.length]
                                    return (
                                        <div key={meal.id} onClick={() => setSelectedMeal(meal)} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '8px', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: dotColor }} />
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-tertiary)', flexShrink: 0, marginLeft: '8px' }}>
                                                {meal.image_url ? <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'}</div>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meal.custom_name || 'Repas'}</p>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{formatTime(meal.logged_at)} · {meal.protein_g}g prot · {meal.carbs_g}g gluc</p>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{ color: dotColor, fontSize: '14px', fontWeight: '600' }}>{Math.round(meal.calories)}<span style={{ color: 'var(--text-muted)', fontSize: '10px' }}> kcal</span></p>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>›</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedMeal && <MealDetailPanel meal={selectedMeal} onClose={() => setSelectedMeal(null)} onDelete={handleDeleteMeal} onImageUpdate={(id, url) => setMealsForDate(prev => prev.map(m => m.id === id ? { ...m, image_url: url } : m))} />}
        </div>
    )
}
