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

    const {
        profile,
        todayMeals,
        setTodayMeals,
        dailyCalories,
        dailyProtein,
        dailyCarbs,
        dailyFat,
    } = useAppStore()

    const [isLoading, setIsLoading] = useState(true)

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

    // ─── Message coach statique ───────────────────────────────
    const getCoachMessage = () => {
        const hour = new Date().getHours()
        const pctDone = dailyCalories / calorieTarget

        // Objectif dépassé
        if (exceeded) {
            const over = Math.round(dailyCalories - calorieTarget)
            return {
                emoji: '⚠️',
                color: '#E24B4A',
                text: `Tu as dépassé ton objectif de ${over} kcal. Essaie de rester léger pour le reste de la journée.`
            }
        }

        // Rien mangé
        if (dailyCalories === 0) {
            if (hour >= 5 && hour < 10) return { emoji: '🌅', color: '#E9C46A', text: `Bonne journée ! Commence par un bon petit-déjeuner pour bien démarrer.` }
            if (hour >= 10 && hour < 14) return { emoji: '☀️', color: '#E9C46A', text: `Il est l'heure de déjeuner ! Tu n'as encore rien mangé aujourd'hui.` }
            if (hour >= 14 && hour < 17) return { emoji: '🥜', color: '#E9C46A', text: `L'après-midi est bien entamé. Pense à manger quelque chose.` }
            return { emoji: '🌙', color: '#E9C46A', text: `Tu n'as rien mangé de la journée. Prends un bon dîner ce soir.` }
        }

        // Moins de 25% atteint
        if (pctDone < 0.25) {
            return { emoji: '💪', color: '#52B788', text: `Bon début ! Il te reste ${Math.round(remaining)} kcal. Continue à bien manger.` }
        }

        // Entre 25% et 60%
        if (pctDone < 0.60) {
            const remainingProtein = Math.max(0, proteinTarget - dailyProtein)
            if (remainingProtein > proteinTarget * 0.5) {
                return { emoji: '🥩', color: '#C4622D', text: `Pense aux protéines ! Il t'en manque encore ${Math.round(remainingProtein)}g. Ajoute du poisson ou de la viande.` }
            }
            return { emoji: '✅', color: '#52B788', text: `Tu es sur la bonne voie. Il te reste ${Math.round(remaining)} kcal pour la journée.` }
        }

        // Entre 60% et 90%
        if (pctDone < 0.90) {
            if (hour >= 17) {
                return { emoji: '🌙', color: '#C4622D', text: `Il te reste ${Math.round(remaining)} kcal pour le dîner. Reste équilibré !` }
            }
            return { emoji: '👍', color: '#52B788', text: `Excellent suivi ! ${Math.round(remaining)} kcal restantes. Tu gères bien ta journée.` }
        }

        // Plus de 90% atteint
        return { emoji: '🎯', color: '#52B788', text: `Presque au bout ! Il ne te reste que ${Math.round(remaining)} kcal. Un petit snack léger suffira.` }
    }

    const coachMsg = getCoachMessage()

    useEffect(() => {
        fetchMeals()
    }, [])

    const fetchMeals = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { console.error("❌ Pas de session"); return }

            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/meals?date=${today}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setTodayMeals(json.data)
            else console.error("❌ API ERROR:", json.error)
        } catch (err) {
            console.error("❌ FETCH ERROR:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteMeal = async (mealId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch(`/api/meals?id=${mealId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setTodayMeals(todayMeals.filter(m => m.id !== mealId))
        } catch (err) {
            console.error(err)
        }
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at top, #1a0f05, #0a0603)',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '30px 20px 120px',
            color: '#fff',
            paddingBottom: '120px'
        }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900' }}>Cal Afrik</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        🔥
                    </div>
                    <div onClick={() => router.push('/profil')} style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg,#C4622D,#E9C46A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', cursor: 'pointer' }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                </div>
            </div>

            {/* CALORIES */}
            <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', borderRadius: '22px', padding: '22px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                <p style={{ color: '#aaa', fontSize: '12px' }}>Calories restantes</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '36px', fontWeight: '900', color: exceeded ? '#E24B4A' : '#fff' }}>{remaining}</h2>
                    <svg width="90" height="90">
                        <circle cx="45" cy="45" r={radius} stroke="#222" strokeWidth="8" fill="none" />
                        <circle cx="45" cy="45" r={radius}
                            stroke={exceeded ? '#E24B4A' : '#C4622D'}
                            strokeWidth="8" fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 45 45)"
                        />
                    </svg>
                </div>
            </div>

            {/* ─── MESSAGE COACH ─── */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${coachMsg.color}33`,
                borderRadius: '16px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
            }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{coachMsg.emoji}</span>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5' }}>
                    {coachMsg.text}
                </p>
            </div>

            {/* MACROS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                {[
                    { label: 'Protéines', val: dailyProtein, color: '#C4622D' },
                    { label: 'Glucides', val: dailyCarbs, color: '#E9C46A' },
                    { label: 'Lipides', val: dailyFat, color: '#52B788' },
                ].map((m, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: `3px solid ${m.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                            {Math.round(m.val)}g
                        </div>
                        <p style={{ color: '#888', fontSize: '12px', marginTop: '6px' }}>{m.label}</p>
                    </div>
                ))}
            </div>

            {/* MEALS */}
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '15px' }}>Repas</h2>

                {isLoading ? (
                    <p style={{ color: '#666' }}>Chargement...</p>
                ) : todayMeals.length === 0 ? (
                    <p style={{ color: '#666' }}>Aucun repas</p>
                ) : (
                    todayMeals.map((meal) => (
                        <div key={meal.id} style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', borderRadius: '18px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <img src={meal.image_url || 'https://via.placeholder.com/60'} style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover' }} />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: '700' }}>{meal.custom_name || 'Repas'}</p>
                                <p style={{ color: '#888', fontSize: '12px' }}>{formatTime(meal.logged_at)}</p>
                            </div>
                            <p style={{ color: '#C4622D', fontWeight: '800' }}>{Math.round(meal.calories)} kcal</p>
                            <button onClick={() => { if (confirm("Supprimer ce repas ?")) handleDeleteMeal(meal.id) }}
                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#ff6b6b', cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* FLOAT BUTTON */}
            <>
                <button onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'fixed', bottom: '80px', right: '25px', width: '65px', height: '65px', borderRadius: '50%', background: 'linear-gradient(135deg,#C4622D,#E9C46A)', border: 'none', fontSize: '28px', fontWeight: '800', boxShadow: '0 10px 40px rgba(196,98,45,0.5)', cursor: 'pointer', zIndex: 1000 }}>
                    +
                </button>
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