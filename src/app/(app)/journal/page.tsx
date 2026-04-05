'use client'

import { useState, useEffect } from 'react'
import { useAppStore, getMealSlot, SLOT_LABELS } from '@/store/useAppStore'
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
    // ✅ On récupère aussi les slots du store
    const { profile, slots } = useAppStore()
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split('T')[0]
    )
    const [meals, setMeals] = useState<Meal[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
    const [showCoach, setShowCoach] = useState(false)

    const calorieTarget = profile?.calorie_target ?? 0
    const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0)
    const totalProtein = meals.reduce((acc, m) => acc + m.protein_g, 0)
    const totalCarbs = meals.reduce((acc, m) => acc + m.carbs_g, 0)
    const totalFat = meals.reduce((acc, m) => acc + m.fat_g, 0)

    useEffect(() => { fetchMeals(selectedDate) }, [selectedDate])

    // ✅ Reset showCoach quand on change de repas sélectionné
    useEffect(() => { setShowCoach(false) }, [selectedMeal])

    const fetchMeals = async (date: string) => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { console.error("❌ Pas de session"); return }

            const res = await fetch(`/api/meals?date=${date}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setMeals(json.data)
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
            if (json.success) {
                setMeals(prev => prev.filter(m => m.id !== mealId))
                setSelectedMeal(null)
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

    // ─── Calcul macros en % pour le détail ───────────────────
    const getMacroPercent = (meal: Meal) => {
        const totalKcal = (meal.protein_g * 4) + (meal.carbs_g * 4) + (meal.fat_g * 9)
        if (totalKcal === 0) return { protein: 0, carbs: 0, fat: 0 }
        return {
            protein: Math.round((meal.protein_g * 4 / totalKcal) * 100),
            carbs: Math.round((meal.carbs_g * 4 / totalKcal) * 100),
            fat: Math.round((meal.fat_g * 9 / totalKcal) * 100),
        }
    }

    // ─── Calories restantes du créneau d'un repas ────────────
    const getSlotInfoForMeal = (meal: Meal) => {
        const mealHour = new Date(meal.logged_at).getHours()
        const slotKey = getMealSlot(mealHour)
        const slot = slots[slotKey]
        const label = SLOT_LABELS[slotKey]
        const remaining = slot.target - slot.consumed
        const exceeded = remaining < 0
        return { label, remaining, exceeded, target: slot.target, consumed: slot.consumed }
    }

    return (
        <>
            <div style={{
                minHeight: '100vh',
                background: '#0F0A06',
                fontFamily: 'system-ui, sans-serif',
                maxWidth: '480px',
                margin: '0 auto',
                paddingBottom: '100px',
            }}>

                {/* ─── Header ─── */}
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
                                <div
                                    key={meal.id}
                                    onClick={() => setSelectedMeal(meal)}
                                    style={{
                                        background: '#1A1108',
                                        border: '1px solid #2A1F14',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '14px',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.2s',
                                    }}
                                >
                                    <div style={{
                                        width: '44px', height: '44px',
                                        borderRadius: '12px', overflow: 'hidden',
                                        background: '#2A1F14', flexShrink: 0,
                                    }}>
                                        {meal.image_url ? (
                                            <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{
                                                width: '100%', height: '100%',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: '20px',
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
                                        textAlign: 'right', flexShrink: 0,
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'flex-end', gap: '6px'
                                    }}>
                                        <p style={{ color: '#C4622D', fontSize: '16px', fontWeight: '800' }}>
                                            {Math.round(meal.calories)}
                                            <span style={{ color: '#555', fontSize: '11px' }}> kcal</span>
                                        </p>
                                        {/* ✅ Petite pastille coach si message disponible */}
                                        {meal.coach_message && (
                                            <span style={{ fontSize: '14px' }}>🤖</span>
                                        )}
                                        <span style={{ color: '#444', fontSize: '16px' }}>›</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* ─── OVERLAY FOND ─── */}
            {selectedMeal && (
                <div
                    onClick={() => setSelectedMeal(null)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        zIndex: 40,
                    }}
                />
            )}

            {/* ─── PANEL DÉTAIL REPAS ─── */}
            {selectedMeal && (() => {
                const macros = getMacroPercent(selectedMeal)
                const slotInfo = getSlotInfoForMeal(selectedMeal)

                return (
                    <div style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        margin: '0 auto',
                        width: '100%',
                        maxWidth: '480px',
                        background: '#1A1108',
                        borderRadius: '24px 24px 0 0',
                        border: '1px solid #2A1F14',
                        zIndex: 50,
                        padding: '0 0 100px 0',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                    }}>
                        {/* Handle */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                            <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px' }} />
                        </div>

                        {/* Image */}
                        {selectedMeal.image_url && (
                            <div style={{ width: '100%', height: '200px', overflow: 'hidden' }}>
                                <img
                                    src={selectedMeal.image_url}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                        )}

                        <div style={{ padding: '20px 24px' }}>

                            {/* Nom + heure */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '800', flex: 1, marginRight: '12px' }}>
                                    {selectedMeal.custom_name || 'Repas'}
                                </h2>
                                <span style={{ color: '#555', fontSize: '13px', flexShrink: 0, marginTop: '4px' }}>
                                    {formatTime(selectedMeal.logged_at)}
                                </span>
                            </div>

                            <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>
                                {MEAL_TYPE_EMOJIS[selectedMeal.meal_type]} {MEAL_TYPE_LABELS[selectedMeal.meal_type]} · {selectedMeal.portion_g}g
                            </p>

                            {/* Calories grandes */}
                            <div style={{
                                background: '#0F0A06',
                                borderRadius: '16px',
                                padding: '20px',
                                textAlign: 'center',
                                marginBottom: '12px',
                            }}>
                                <p style={{ color: '#C4622D', fontSize: '48px', fontWeight: '800', letterSpacing: '-2px' }}>
                                    {Math.round(selectedMeal.calories)}
                                </p>
                                <p style={{ color: '#555', fontSize: '14px' }}>kilocalories</p>
                            </div>

                            {/* ✅ Calories restantes du créneau concerné par ce repas */}
                            <div style={{
                                background: slotInfo.exceeded ? 'rgba(226,75,74,0.08)' : 'rgba(196,98,45,0.08)',
                                border: `1px solid ${slotInfo.exceeded ? '#3A1010' : '#2A1F14'}`,
                                borderRadius: '12px',
                                padding: '12px 16px',
                                marginBottom: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <div>
                                    <p style={{ color: '#555', fontSize: '11px' }}>Créneau</p>
                                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>{slotInfo.label}</p>
                                    <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>
                                        {Math.round(slotInfo.consumed)} / {slotInfo.target} kcal consommés
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ color: '#555', fontSize: '11px' }}>
                                        {slotInfo.exceeded ? '⚠️ Dépassement' : 'Restant'}
                                    </p>
                                    <p style={{
                                        color: slotInfo.exceeded ? '#E24B4A' : '#C4622D',
                                        fontWeight: '800',
                                        fontSize: '20px',
                                    }}>
                                        {slotInfo.exceeded
                                            ? `+${Math.abs(Math.round(slotInfo.remaining))} kcal`
                                            : `${Math.round(slotInfo.remaining)} kcal`
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Macros détaillées */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                                {[
                                    { label: 'Protéines', value: selectedMeal.protein_g, unit: 'g', color: '#52B788', pct: macros.protein },
                                    { label: 'Glucides', value: selectedMeal.carbs_g, unit: 'g', color: '#E9C46A', pct: macros.carbs },
                                    { label: 'Lipides', value: selectedMeal.fat_g, unit: 'g', color: '#E07040', pct: macros.fat },
                                ].map(m => (
                                    <div key={m.label} style={{
                                        background: '#0F0A06',
                                        borderRadius: '14px',
                                        padding: '14px 10px',
                                        textAlign: 'center',
                                    }}>
                                        <p style={{ color: m.color, fontSize: '22px', fontWeight: '800' }}>
                                            {m.value}{m.unit}
                                        </p>
                                        <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{m.label}</p>
                                        <p style={{ color: '#333', fontSize: '10px', marginTop: '2px' }}>{m.pct}%</p>
                                    </div>
                                ))}
                            </div>

                            {/* Barre macros visuelle */}
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
                                    <div style={{ width: `${macros.protein}%`, background: '#52B788', borderRadius: '4px 0 0 4px' }} />
                                    <div style={{ width: `${macros.carbs}%`, background: '#E9C46A' }} />
                                    <div style={{ width: `${macros.fat}%`, background: '#E07040', borderRadius: '0 4px 4px 0' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                    <span style={{ color: '#52B788', fontSize: '10px' }}>Prot. {macros.protein}%</span>
                                    <span style={{ color: '#E9C46A', fontSize: '10px' }}>Gluc. {macros.carbs}%</span>
                                    <span style={{ color: '#E07040', fontSize: '10px' }}>Lip. {macros.fat}%</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedMeal.notes && (
                                <div style={{
                                    background: '#0F0A06',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    marginBottom: '20px',
                                }}>
                                    <p style={{ color: '#777', fontSize: '12px', marginBottom: '4px' }}>Notes</p>
                                    <p style={{ color: '#aaa', fontSize: '13px' }}>{selectedMeal.notes}</p>
                                </div>
                            )}

                            {/* ✅ CONSEIL COACH — affiché seulement si coach_message existe */}
                            {selectedMeal?.coach_message && (
                                <div style={{ marginBottom: '16px' }}>
                                    <button
                                        onClick={() => setShowCoach(!showCoach)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: showCoach ? '#2A1F00' : 'transparent',
                                            border: '1px solid #F5A623',
                                            color: '#F5A623',
                                            fontWeight: '600',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            marginBottom: showCoach ? '8px' : '0',
                                        }}
                                    >
                                        {showCoach ? '🤖 Conseil du coach' : '💡 Voir le conseil du coach →'}
                                    </button>
                                    {showCoach && (
                                        <div style={{
                                            background: '#2A1F00',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            border: '1px solid #3A2F00',
                                        }}>
                                            <p style={{ color: '#FFD88A', fontSize: '13px', lineHeight: '1.6' }}>
                                                {selectedMeal.coach_message}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Boutons retour + supprimer */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setSelectedMeal(null)}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        borderRadius: '12px',
                                        background: '#2A1F14',
                                        border: '1px solid #333',
                                        color: '#fff',
                                        fontWeight: '600',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ← Retour
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm("Supprimer ce repas ?")) {
                                            handleDeleteMeal(selectedMeal.id)
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        borderRadius: '12px',
                                        background: 'transparent',
                                        border: '1px solid #ff6b6b',
                                        color: '#ff6b6b',
                                        fontWeight: '600',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    🗑️ Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </>
    )
}