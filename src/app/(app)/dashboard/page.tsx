'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { getProgressPercent } from '@/lib/nutrition'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRef } from 'react'

export default function DashboardPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const { profile, todayMeals, setTodayMeals, dailyCalories, dailyProtein, dailyCarbs, dailyFat } = useAppStore()

    const [isLoading, setIsLoading] = useState(true)
    const [currentHour, setCurrentHour] = useState(new Date().getHours())

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65
    const remaining = Math.max(0, calorieTarget - dailyCalories)
    const exceeded = dailyCalories > calorieTarget

    const radius = 40
    const circumference = 2 * Math.PI * radius
    const percent = getProgressPercent(dailyCalories, calorieTarget)
    const strokeDashoffset = circumference - (percent / 100) * circumference

    useEffect(() => { setCurrentHour(new Date().getHours()) }, [])

    const getCoachMessage = () => {
        const hour = currentHour
        const pctDone = dailyCalories / calorieTarget

        if (exceeded) {
            const over = Math.round(dailyCalories - calorieTarget)
            return { emoji: '⚠️', text: `Tu as dépassé ton objectif de ${over} kcal. Essaie de rester léger pour le reste de la journée.` }
        }
        if (dailyCalories === 0) {
            if (hour >= 5 && hour < 10) return { emoji: '🌅', text: `Bonne journée ! Commence par un bon petit-déjeuner pour bien démarrer.` }
            if (hour >= 10 && hour < 14) return { emoji: '☀️', text: `Il est l'heure de déjeuner ! Tu n'as encore rien mangé aujourd'hui.` }
            if (hour >= 14 && hour < 17) return { emoji: '🥜', text: `L'après-midi est bien entamé. Pense à manger quelque chose.` }
            return { emoji: '🌙', text: `Tu n'as rien mangé de la journée. Prends un bon dîner ce soir.` }
        }
        if (pctDone < 0.25) return { emoji: '💪', text: `Bon début ! Il te reste ${Math.round(remaining)} kcal. Continue à bien manger.` }
        if (pctDone < 0.60) {
            const remainingProtein = Math.max(0, proteinTarget - dailyProtein)
            if (remainingProtein > proteinTarget * 0.5)
                return { emoji: '🥩', text: `Pense aux protéines ! Il t'en manque encore ${Math.round(remainingProtein)}g.` }
            return { emoji: '✅', text: `Tu es sur la bonne voie. Il te reste ${Math.round(remaining)} kcal pour la journée.` }
        }
        if (pctDone < 0.90) {
            if (hour >= 17) return { emoji: '🌙', text: `Il te reste ${Math.round(remaining)} kcal pour le dîner. Reste équilibré !` }
            return { emoji: '👍', text: `Excellent suivi ! ${Math.round(remaining)} kcal restantes. Tu gères bien ta journée.` }
        }
        return { emoji: '🎯', text: `Presque au bout ! Il ne te reste que ${Math.round(remaining)} kcal. Un petit snack léger suffira.` }
    }

    const coachMsg = getCoachMessage()

    useEffect(() => { fetchMeals() }, [])

    const fetchMeals = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/meals?date=${today}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
            const json = await res.json()
            if (json.success) setTodayMeals(json.data)
        } catch (err) { console.error(err) }
        finally { setIsLoading(false) }
    }

    const handleDeleteMeal = async (mealId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
            const json = await res.json()
            if (json.success) setTodayMeals(todayMeals.filter(m => m.id !== mealId))
        } catch (err) { console.error(err) }
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const macros = [
        { label: 'Protéines', val: dailyProtein, target: proteinTarget, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
        { label: 'Glucides', val: dailyCarbs, target: carbsTarget, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        { label: 'Lipides', val: dailyFat, target: fatTarget, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    ]

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '30px 20px 120px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
        }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>🌍</div>
                    <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>Cal Afrik</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#141414', border: '0.5px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🔥</div>
                    <div onClick={() => router.push('/profil')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px', color: '#fff', cursor: 'pointer' }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                </div>
            </div>

            {/* CARTE CALORIES */}
            <div style={{ background: '#141414', borderRadius: '20px', padding: '20px', border: '0.5px solid #222', marginBottom: '12px', position: 'relative', overflow: 'hidden' }}>
                {/* ligne déco */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: exceeded ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #6366f1, #10b981, #f59e0b)' }} />
                <p style={{ color: '#555', fontSize: '12px', marginBottom: '8px' }}>Calories restantes</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '40px', fontWeight: '700', color: exceeded ? '#ef4444' : '#fff', letterSpacing: '-1.5px' }}>{remaining}</h2>
                        <p style={{ color: '#444', fontSize: '12px', marginTop: '2px' }}>/ {calorieTarget} kcal · <span style={{ color: exceeded ? '#ef4444' : '#6366f1' }}>{Math.round(percent)}% atteint</span></p>
                    </div>
                    <svg width="90" height="90">
                        <circle cx="45" cy="45" r={radius} stroke="#1e1e1e" strokeWidth="6" fill="none" />
                        <circle cx="45" cy="45" r={radius}
                            stroke={exceeded ? '#ef4444' : 'url(#ringGrad)'}
                            strokeWidth="6" fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 45 45)"
                        />
                        <defs>
                            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>

            {/* MESSAGE COACH */}
            <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '14px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '0.5px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    {coachMsg.emoji}
                </div>
                <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.5' }}>{coachMsg.text}</p>
            </div>

            {/* MACROS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px', gap: '8px' }}>
                {macros.map((m) => {
                    const pct = Math.min(100, Math.round((m.val / m.target) * 100))
                    return (
                        <div key={m.label} style={{ flex: 1, background: '#141414', border: '0.5px solid #222', borderRadius: '14px', padding: '12px 10px', textAlign: 'center' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${m.color}`, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '12px', fontWeight: '600', color: m.color }}>
                                {Math.round(m.val)}g
                            </div>
                            <p style={{ color: '#555', fontSize: '10px' }}>{m.label}</p>
                            <div style={{ height: '2px', background: '#222', borderRadius: '1px', marginTop: '6px' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: '1px' }} />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* REPAS */}
            <div>
                <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-block', width: '3px', height: '14px', background: 'linear-gradient(#6366f1, #10b981)', borderRadius: '2px' }} />
                    Repas du jour
                </h2>

                {isLoading ? (
                    <p style={{ color: '#333', fontSize: '13px' }}>Chargement...</p>
                ) : todayMeals.length === 0 ? (
                    <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
                        <p style={{ fontSize: '28px', marginBottom: '8px' }}>🍽️</p>
                        <p style={{ color: '#333', fontSize: '13px' }}>Aucun repas enregistré aujourd'hui</p>
                        <p style={{ color: '#222', fontSize: '12px', marginTop: '4px' }}>Appuie sur + pour scanner ton repas</p>
                    </div>
                ) : (
                    todayMeals.map((meal, idx) => {
                        const dotColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']
                        const dotColor = dotColors[idx % dotColors.length]
                        return (
                            <div key={meal.id} style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <img src={meal.image_url || 'https://via.placeholder.com/48'} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', background: dotColor, border: '1.5px solid #0a0a0a' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: '500', fontSize: '13px', color: '#fff' }}>{meal.custom_name || 'Repas'}</p>
                                    <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>{formatTime(meal.logged_at)}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ color: dotColor, fontWeight: '600', fontSize: '13px' }}>{Math.round(meal.calories)}</p>
                                    <p style={{ color: '#333', fontSize: '10px' }}>kcal</p>
                                </div>
                                <button onClick={() => { if (confirm('Supprimer ce repas ?')) handleDeleteMeal(meal.id) }}
                                    style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '6px 9px', color: '#444', cursor: 'pointer', fontSize: '11px' }}>
                                    ✕
                                </button>
                            </div>
                        )
                    })
                )}
            </div>

            {/* FAB */}
            <>
                <button onClick={() => fileInputRef.current?.click()} style={{
                    position: 'fixed', bottom: '80px', right: '24px',
                    width: '58px', height: '58px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #10b981)',
                    border: 'none', fontSize: '26px', color: '#fff',
                    boxShadow: '0 8px 28px rgba(99,102,241,0.4)',
                    cursor: 'pointer', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</button>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                            ; (window as any).tempImage = file
                        router.push('/scanner')
                    }}
                />
            </>
        </div>
    )
}