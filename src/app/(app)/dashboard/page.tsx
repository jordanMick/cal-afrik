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

    const getCoachMessage = () => {
        const hour = new Date().getHours()
        const pctDone = dailyCalories / calorieTarget

        if (exceeded) {
            const over = Math.round(dailyCalories - calorieTarget)
            return {
                emoji: '⚠️',
                text: `Tu as dépassé ton objectif de ${over} kcal. Essaie de rester léger pour le reste de la journée.`
            }
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
            const res = await fetch(`/api/meals?date=${today}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setTodayMeals(json.data)
        } catch (err) {
            console.error(err)
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
            background: '#0a0a0a',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '30px 20px 120px',
            color: '#fff',
        }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#fff' }}>Cal Afrik</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: '#161616', border: '0.5px solid #2a2a2a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                    }}>
                        🔥
                    </div>
                    <div onClick={() => router.push('/profil')} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '500', fontSize: '14px', color: '#000', cursor: 'pointer'
                    }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                </div>
            </div>

            {/* CALORIES */}
            <div style={{
                background: '#161616',
                borderRadius: '18px',
                padding: '20px',
                border: '0.5px solid #2a2a2a',
                marginBottom: '12px'
            }}>
                <p style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>Calories restantes</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '36px', fontWeight: '500', color: exceeded ? '#ff5555' : '#fff', letterSpacing: '-1px' }}>
                            {remaining}
                        </h2>
                        <p style={{ color: '#444', fontSize: '12px', marginTop: '2px' }}>/ {calorieTarget} kcal</p>
                    </div>
                    <svg width="90" height="90">
                        <circle cx="45" cy="45" r={radius} stroke="#222" strokeWidth="6" fill="none" />
                        <circle cx="45" cy="45" r={radius}
                            stroke={exceeded ? '#ff5555' : '#fff'}
                            strokeWidth="6" fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 45 45)"
                        />
                    </svg>
                </div>
            </div>

            {/* COACH MESSAGE */}
            <div style={{
                background: '#111',
                border: '0.5px solid #2a2a2a',
                borderRadius: '14px',
                padding: '12px 14px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
            }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{coachMsg.emoji}</span>
                <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.5' }}>
                    {coachMsg.text}
                </p>
            </div>

            {/* MACROS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
                {[
                    { label: 'Protéines', val: dailyProtein, target: proteinTarget },
                    { label: 'Glucides', val: dailyCarbs, target: carbsTarget },
                    { label: 'Lipides', val: dailyFat, target: fatTarget },
                ].map((m, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '68px', height: '68px', borderRadius: '50%',
                            border: '2px solid #fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '500', fontSize: '13px', color: '#fff',
                        }}>
                            {Math.round(m.val)}g
                        </div>
                        <p style={{ color: '#555', fontSize: '11px', marginTop: '6px' }}>{m.label}</p>
                        <p style={{ color: '#333', fontSize: '10px' }}>{m.target}g</p>
                    </div>
                ))}
            </div>

            {/* MEALS */}
            <div>
                <h2 style={{ fontSize: '15px', fontWeight: '500', color: '#fff', marginBottom: '12px' }}>Repas</h2>

                {isLoading ? (
                    <p style={{ color: '#444', fontSize: '13px' }}>Chargement...</p>
                ) : todayMeals.length === 0 ? (
                    <div style={{
                        background: '#161616', border: '0.5px solid #2a2a2a',
                        borderRadius: '14px', padding: '28px', textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '24px', marginBottom: '6px' }}>🍽️</p>
                        <p style={{ color: '#444', fontSize: '13px' }}>Aucun repas enregistré aujourd'hui</p>
                    </div>
                ) : (
                    todayMeals.map((meal) => (
                        <div key={meal.id} style={{
                            background: '#161616',
                            border: '0.5px solid #2a2a2a',
                            borderRadius: '14px',
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                        }}>
                            <img
                                src={meal.image_url || 'https://via.placeholder.com/52'}
                                style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' }}
                            />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: '500', fontSize: '13px', color: '#fff' }}>
                                    {meal.custom_name || 'Repas'}
                                </p>
                                <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
                                    {formatTime(meal.logged_at)}
                                </p>
                            </div>
                            <p style={{ color: '#fff', fontWeight: '500', fontSize: '13px' }}>
                                {Math.round(meal.calories)} kcal
                            </p>
                            <button
                                onClick={() => { if (confirm('Supprimer ce repas ?')) handleDeleteMeal(meal.id) }}
                                style={{
                                    background: '#1e1e1e', border: '0.5px solid #333',
                                    borderRadius: '8px', padding: '6px 10px',
                                    color: '#555', cursor: 'pointer', fontSize: '12px'
                                }}>
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* FLOAT BUTTON */}
            <>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        position: 'fixed', bottom: '80px', right: '25px',
                        width: '60px', height: '60px', borderRadius: '50%',
                        background: '#fff', border: 'none',
                        fontSize: '26px', color: '#000', fontWeight: '500',
                        boxShadow: '0 8px 32px rgba(255,255,255,0.15)',
                        cursor: 'pointer', zIndex: 1000
                    }}>
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