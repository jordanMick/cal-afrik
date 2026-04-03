'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { Meal } from '@/types'
import { supabase } from '@/lib/supabase'

const MEAL_TYPE_LABELS: Record<string, string> = {
    petit_dejeuner: 'Petit-déjeuner',
    dejeuner: 'Déjeuner',
    diner: 'Dîner',
    collation: 'Collation',
}

const MEAL_TYPE_EMOJIS: Record<string, string> = {
    petit_dejeuner: '🌅',
    dejeuner: '☀️',
    diner: '🌙',
    collation: '🥜',
}

export default function JournalPage() {
    const { profile } = useAppStore()
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split('T')[0]
    )
    const [meals, setMeals] = useState<Meal[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const calorieTarget = profile?.calorie_target || 2000
    const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0)
    const totalProtein = meals.reduce((acc, m) => acc + m.protein_g, 0)
    const totalCarbs = meals.reduce((acc, m) => acc + m.carbs_g, 0)
    const totalFat = meals.reduce((acc, m) => acc + m.fat_g, 0)

    useEffect(() => { fetchMeals(selectedDate) }, [selectedDate])



    const fetchMeals = async (date: string) => {
        setIsLoading(true)

        try {
            // 🔥 récupérer session
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                console.error("❌ Pas de session")
                return
            }

            const res = await fetch(`/api/meals?date=${date}`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}` // ✅ IMPORTANT
                }
            })

            const json = await res.json()

            console.log("🔥 MEALS:", json)

            if (json.success) {
                setMeals(json.data)
            } else {
                console.error("❌ API ERROR:", json.error)
            }

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
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            })

            const json = await res.json()

            if (json.success) {
                // 🔥 supprime direct dans l’UI
                setMeals(prev => prev.filter(m => m.id !== mealId))
            }

        } catch (err) {
            console.error(err)
        }

    }

    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
    }).reverse()

    const formatDayLabel = (dateStr: string) => {
        const today = new Date().toISOString().split('T')[0]
        if (dateStr === today) return 'Auj.'
        return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
    }

    const formatFullDate = (dateStr: string) => {
        const today = new Date().toISOString().split('T')[0]
        if (dateStr === today) return "Aujourd'hui"
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long',
        })
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const progressWidth = Math.min(100, (totalCalories / calorieTarget) * 100)

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0F0A06',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            paddingBottom: '100px',
        }}>

            {/* Header */}
            <div style={{
                padding: '52px 24px 24px',
                borderBottom: '1px solid #2A1F14',
            }}>
                <h1 style={{
                    color: '#fff', fontSize: '28px',
                    fontWeight: '800', letterSpacing: '-0.5px',
                    marginBottom: '20px',
                }}>
                    Journal
                </h1>

                {/* Sélecteur 7 jours */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {last7Days.map((date) => {
                        const isSelected = date === selectedDate
                        return (
                            <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                style={{
                                    flexShrink: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    padding: '10px 14px',
                                    background: isSelected ? '#C4622D' : '#1A1108',
                                    border: `1px solid ${isSelected ? '#C4622D' : '#2A1F14'}`,
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    minWidth: '52px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <span style={{
                                    color: isSelected ? 'rgba(255,255,255,0.8)' : '#555',
                                    fontSize: '11px', marginBottom: '4px',
                                }}>
                                    {formatDayLabel(date)}
                                </span>
                                <span style={{
                                    color: isSelected ? '#fff' : '#999',
                                    fontSize: '18px', fontWeight: '800',
                                }}>
                                    {new Date(date).getDate()}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div style={{ padding: '24px', position: 'relative', zIndex: 1 }}>

                {/* Date */}
                <p style={{
                    color: '#555', fontSize: '13px', textTransform: 'capitalize',
                    marginBottom: '16px',
                }}>
                    {formatFullDate(selectedDate)}
                </p>

                {/* Résumé */}
                <div style={{
                    background: '#1A1108',
                    border: '1px solid #2A1F14',
                    borderRadius: '20px',
                    padding: '20px',
                    marginBottom: '24px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                        <span style={{ color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-1px' }}>
                            {Math.round(totalCalories)}
                            <span style={{ color: '#555', fontSize: '14px', fontWeight: '400', marginLeft: '4px' }}>kcal</span>
                        </span>
                        <span style={{ color: '#555', fontSize: '13px' }}>
                            / {calorieTarget} kcal
                        </span>
                    </div>

                    <div style={{
                        width: '100%', height: '6px',
                        background: '#2A1F14', borderRadius: '3px',
                        marginBottom: '16px',
                    }}>
                        <div style={{
                            height: '100%', borderRadius: '3px',
                            width: `${progressWidth}%`,
                            background: totalCalories > calorieTarget ? '#E24B4A' : '#C4622D',
                            transition: 'width 0.6s ease',
                        }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        {[
                            { label: 'Protéines', value: Math.round(totalProtein), color: '#52B788' },
                            { label: 'Glucides', value: Math.round(totalCarbs), color: '#E9C46A' },
                            { label: 'Lipides', value: Math.round(totalFat), color: '#888' },
                        ].map((m) => (
                            <div key={m.label} style={{
                                background: '#0F0A06',
                                borderRadius: '12px',
                                padding: '12px',
                                textAlign: 'center',
                            }}>
                                <p style={{ color: m.color, fontSize: '18px', fontWeight: '800' }}>
                                    {m.value}g
                                </p>
                                <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Liste repas */}
                <p style={{
                    color: '#555', fontSize: '12px', fontWeight: '700',
                    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px'
                }}>
                    Repas
                </p>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#444' }}>
                        Chargement...
                    </div>
                ) : meals.length === 0 ? (
                    <div style={{
                        background: '#1A1108',
                        border: '1px solid #2A1F14',
                        borderRadius: '20px',
                        padding: '48px 24px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>
                            Aucun repas ce jour
                        </p>
                        <p style={{ color: '#555', fontSize: '13px', marginTop: '6px' }}>
                            Scannez vos plats pour les voir ici
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {meals.map((meal) => (
                            <div key={meal.id} style={{
                                background: '#1A1108',
                                border: '1px solid #2A1F14',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                            }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    background: '#2A1F14',
                                    flexShrink: 0,
                                }}>
                                    {meal.image_url ? (
                                        <img
                                            src={meal.image_url}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '20px',
                                        }}>
                                            {MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'}
                                        </div>
                                    )}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        color: '#fff', fontSize: '14px', fontWeight: '600',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {meal.custom_name || 'Repas'}
                                    </p>
                                    <p style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>
                                        {formatTime(meal.logged_at)}
                                    </p>
                                    <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>
                                        {meal.protein_g}g prot · {meal.carbs_g}g gluc · {meal.fat_g}g lip
                                    </p>
                                </div>

                                <div style={{
                                    textAlign: 'right',
                                    flexShrink: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    gap: '6px'
                                }}>
                                    <p style={{ color: '#C4622D', fontSize: '16px', fontWeight: '800' }}>
                                        {Math.round(meal.calories)}
                                        <span style={{ color: '#555', fontSize: '11px' }}> kcal</span>
                                    </p>

                                    <button
                                        onClick={() => {
                                            if (confirm("Supprimer ce repas ?")) {
                                                handleDeleteMeal(meal.id)
                                            }
                                        }}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '4px 8px',
                                            color: '#ff6b6b',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}