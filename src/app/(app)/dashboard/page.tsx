'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { getProgressPercent } from '@/lib/nutrition'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRef } from 'react'

const MEAL_TYPE_LABELS: Record<string, string> = {
    petit_dejeuner: 'Petit-déjeuner',
    dejeuner: 'Déjeuner',
    diner: 'Dîner',
    collation: 'Collation',
}

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
        removeMeal,
    } = useAppStore()

    const [isLoading, setIsLoading] = useState(true)

    const calorieTarget = profile?.calorie_target || 2000
    const remaining = Math.max(0, calorieTarget - dailyCalories)

    const radius = 40
    const circumference = 2 * Math.PI * radius
    const percent = getProgressPercent(dailyCalories, calorieTarget)
    const strokeDashoffset = circumference - (percent / 100) * circumference

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
            console.log("🔥 DASHBOARD MEALS:", json)
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
            console.log("🔥 DELETE:", json)
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
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px'
            }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900' }}>
                    Cal Afrik
                </h1>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{
                        width: '38px', height: '38px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        🔥
                    </div>

                    {/* ✅ Clic → page stats */}
                    <div
                        onClick={() => router.push('/profil')}
                        style={{
                            width: '38px', height: '38px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg,#C4622D,#E9C46A)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800',
                            cursor: 'pointer'
                        }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                </div>
            </div>

            {/* CALORIES */}
            <div style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                borderRadius: '22px',
                padding: '22px',
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '25px'
            }}>
                <p style={{ color: '#aaa', fontSize: '12px' }}>Calories restantes</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '36px', fontWeight: '900' }}>{remaining}</h2>
                    <svg width="90" height="90">
                        <circle cx="45" cy="45" r={radius} stroke="#222" strokeWidth="8" fill="none" />
                        <circle cx="45" cy="45" r={radius}
                            stroke="#C4622D" strokeWidth="8" fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 45 45)"
                        />
                    </svg>
                </div>
            </div>

            {/* MACROS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                {[
                    { label: 'Protéines', val: dailyProtein, color: '#C4622D' },
                    { label: 'Glucides', val: dailyCarbs, color: '#E9C46A' },
                    { label: 'Lipides', val: dailyFat, color: '#52B788' },
                ].map((m, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '70px', height: '70px', borderRadius: '50%',
                            border: `3px solid ${m.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800'
                        }}>
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
                        <div key={meal.id} style={{
                            background: 'rgba(255,255,255,0.04)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '18px',
                            padding: '14px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            marginBottom: '12px'
                        }}>
                            <img
                                src={meal.image_url || 'https://via.placeholder.com/60'}
                                style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover' }}
                            />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: '700' }}>{meal.custom_name || 'Repas'}</p>
                                <p style={{ color: '#888', fontSize: '12px' }}>{formatTime(meal.logged_at)}</p>
                            </div>
                            <p style={{ color: '#C4622D', fontWeight: '800' }}>{Math.round(meal.calories)} kcal</p>
                            <button
                                onClick={() => { if (confirm("Supprimer ce repas ?")) handleDeleteMeal(meal.id) }}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: 'none',
                                    borderRadius: '8px', padding: '6px 10px',
                                    color: '#ff6b6b', cursor: 'pointer'
                                }}
                            >✕</button>
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
                        width: '65px', height: '65px', borderRadius: '50%',
                        background: 'linear-gradient(135deg,#C4622D,#E9C46A)',
                        border: 'none', fontSize: '28px', fontWeight: '800',
                        boxShadow: '0 10px 40px rgba(196,98,45,0.5)',
                        cursor: 'pointer', zIndex: 1000
                    }}
                >+</button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        console.log("Image capturée :", file)
                            ; (window as any).tempImage = file
                        router.push('/scanner')
                    }}
                />
            </>
        </div>
    )
}