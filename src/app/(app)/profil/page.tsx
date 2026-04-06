'use client'

import { useEffect, useState } from 'react'
import { useAppStore, MealSlotKey, SLOT_LABELS, NEXT_SLOT } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { getProgressPercent } from '@/lib/nutrition'
import { supabase } from '@/lib/supabase'
import { checkPermission } from '@/lib/subscription'

const GOAL_LABELS: Record<string, string> = { perdre: 'Perdre du poids', maintenir: 'Maintenir le poids', prendre: 'Prendre du poids' }
const ACTIVITY_LABELS: Record<string, string> = { sedentaire: 'Sédentaire', leger: 'Légèrement actif', modere: 'Modérément actif', actif: 'Très actif', tres_actif: 'Extrêmement actif' }

function getActiveBilanSlot(hour: number, minutes: number = 0): MealSlotKey {
    // Règle : Un bilan reste affiché jusqu'à 30 minutes avant le début du suivant
    const time = hour + minutes / 60

    if (time >= 22.5 || time < 11.5) return 'diner'           // Bilan journée visible de 22h30 à 11h30
    if (time >= 18.5 && time < 22.5) return 'collation'       // Bilan collation visible de 18h30 à 22h30
    if (time >= 15.5 && time < 18.5) return 'dejeuner'        // Bilan déjeuner visible de 15h30 à 18h30
    if (time >= 11.5 && time < 15.5) return 'petit_dejeuner'  // Bilan petit-déjeuner de 11h30 à 15h30
    
    return 'diner'
}

function getNextSlotInfo(hour: number): { label: string; time: string } {
    if (hour >= 8 && hour < 12) return { label: 'Petit-déjeuner', time: '12h00' }
    if (hour >= 12 && hour < 16) return { label: 'Déjeuner', time: '16h00' }
    if (hour >= 16 && hour < 19) return { label: 'Collation', time: '19h00' }
    if (hour >= 19 && hour < 23) return { label: 'Dîner', time: '23h00' }
    return { label: 'Petit-déjeuner', time: '12h00' }
}


const STAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']

export default function ProfilPage() {
    const router = useRouter()
    const { profile, dailyCalories, dailyProtein, dailyCarbs, dailyFat, slots, slotBilans, setSlotBilan, todayMeals } = useAppStore()

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65

    const now = new Date()
    const hour = now.getHours()
    const minutes = now.getMinutes()
    const today = now.toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const isBefore11 = hour < 11
    const bilanDinerDate = isBefore11 ? yesterday : today

    const activeSlot = getActiveBilanSlot(hour, minutes)
    const bilanDate = activeSlot === 'diner' ? bilanDinerDate : today
    const existingBilan = activeSlot ? slotBilans[activeSlot] : null
    
    // VALIDITÉ : On ajoute un check sur le message si l'utilisateur est Premium
    const needsKofiMessage = profile?.subscription_tier === 'premium' && (!existingBilan?.message || existingBilan.message === "")
    const bilanIsValid = existingBilan && existingBilan.date === bilanDate && !existingBilan.needsRefresh && !needsKofiMessage
    
    const shouldGenerate = !!activeSlot && !bilanIsValid
    const shouldShowExisting = !!activeSlot && bilanIsValid

    // Déterminer le statut initial si on a déjà un bilan
    const getInitialStatus = () => {
        if (!shouldShowExisting) return null
        if (!existingBilan) return null
        if (existingBilan.message === "" && activeSlot !== 'diner') return 'empty'
        return 'done'
    }

    const [bilanStatus, setBilanStatus] = useState<'loading' | 'done' | 'empty' | null>(getInitialStatus())

    useEffect(() => { 
        if (shouldGenerate) {
            setBilanStatus('loading')
            loadBilan(activeSlot!); 
        } else if (shouldShowExisting) {
            setBilanStatus(getInitialStatus())
        }
    }, [activeSlot, profile?.subscription_tier, bilanDate])

    const loadBilan = async (slot: MealSlotKey) => {
        const slotMeals = slot !== 'diner'
            ? todayMeals.filter(m => { const h = new Date(m.logged_at).getHours(); if (slot === 'petit_dejeuner') return h >= 0 && h < 12; if (slot === 'dejeuner') return h >= 12 && h < 16; if (slot === 'collation') return h >= 16 && h < 19; return false })
            : todayMeals

        if (slot !== 'diner' && slotMeals.length === 0) { setBilanStatus('empty'); setSlotBilan(slot, { message: '', goalReached: false, exceeded: false, date: bilanDate, needsRefresh: false }); return }
        setBilanStatus('loading')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const slotData = slots[slot]
            const nextSlot = NEXT_SLOT[slot]
            const res = await fetch('/api/bilan', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ type: slot === 'diner' ? 'journee' : 'creneau', slot, slotLabel: SLOT_LABELS[slot], nextSlotLabel: nextSlot ? SLOT_LABELS[nextSlot] : null, slotConsumed: slotData.consumed, slotTarget: slotData.target, dailyCalories, dailyProtein, dailyCarbs, dailyFat, calorieTarget, proteinTarget, carbsTarget, fatTarget, goal: profile?.goal || 'maintenir', meals: slotMeals.map(m => ({ name: m.custom_name || 'Repas', calories: m.calories })) }) })
            const json = await res.json()
            if (!json.success) { setSlotBilan(slot, { message: slot === 'diner' ? 'Belle journée ! Repose-toi bien. 💪' : `Bilan ${SLOT_LABELS[slot]} non disponible.`, goalReached: false, exceeded: false, date: bilanDate, needsRefresh: false }); setBilanStatus('done'); return }
            setSlotBilan(slot, { message: json.message, goalReached: json.goalReached, exceeded: json.exceeded, date: bilanDate, needsRefresh: false })
            setBilanStatus('done')
        } catch (err) { console.error(err); setBilanStatus('done') }
    }

    const currentBilan = activeSlot ? slotBilans[activeSlot] : null
    const goalReached = currentBilan?.goalReached ?? false
    const exceeded = currentBilan?.exceeded ?? false
    const bilanMessage = currentBilan?.message ?? ''
    const bilanEmoji = goalReached ? '🎉' : exceeded ? '⚠️' : '📊'
    const bilanTitle = activeSlot === 'diner' ? (goalReached ? 'Objectif atteint !' : exceeded ? 'Objectif dépassé' : 'Journée incomplète') : `Bilan ${activeSlot ? SLOT_LABELS[activeSlot] : ''}`
    const bilanColor = goalReached ? '#10b981' : exceeded ? '#ef4444' : '#f59e0b'

    const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

    const stats = [
        { label: 'Calories', current: dailyCalories, target: calorieTarget, unit: 'kcal', color: STAT_COLORS[0] },
        { label: 'Protéines', current: dailyProtein, target: proteinTarget, unit: 'g', color: STAT_COLORS[1] },
        { label: 'Glucides', current: dailyCarbs, target: carbsTarget, unit: 'g', color: STAT_COLORS[2] },
        { label: 'Lipides', current: dailyFat, target: fatTarget, unit: 'g', color: STAT_COLORS[3] },
    ]

    // LOGIQUE DE BILAN AUTOMATIQUE (NON-AI) POUR PRO/FREE
    const getAutomatedBilan = () => {
        const calPercent = (dailyCalories / calorieTarget) * 100
        const protPercent = (dailyProtein / proteinTarget) * 100
        
        let message = ""
        let kofiNudge = ""

        if (calPercent > 105) {
            message = "⚠️ Budget calories dépassé. Essayez de compenser sur le prochain repas."
            kofiNudge = "Kofi vous dirait quel type d'activité physique exacte ferait fondre cet excès."
        } else if (calPercent < 80) {
            message = "✅ Vous avez encore de la marge calorique pour aujourd'hui."
            kofiNudge = "Kofi vous suggérerait le plat idéal pour combler ce vide sans casser votre rythme."
        } else {
            message = "🎯 Équilibre calorique exemplaire. Continuez comme ça !"
            kofiNudge = "Kofi analyserait la qualité nutritionnelle de ces calories pour optimiser votre énergie."
        }

        if (protPercent < 70) {
            message += " Pensez à augmenter vos protéines."
            kofiNudge = "Kofi vous proposerait une liste de snacks hyper-protéinés adaptés à vos goûts."
        }

        return { message, kofiNudge }
    }

    const { message: autoMessage, kofiNudge } = getAutomatedBilan()

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', position: 'relative', overflow: 'hidden' }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: '52px 20px 24px' }}>
                <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.5px' }}>Mon Profil</h1>

                {/* BLOC PROFIL CONSOLIDÉ */}
                <div style={{
                    background: '#141414',
                    borderRadius: '24px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: '0.5px solid #222',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    {/* Décoration en arrière-plan */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '68px', height: '68px', borderRadius: '22px',
                            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '30px', fontWeight: 'bold', color: '#fff',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                            flexShrink: 0
                        }}>
                            {profile?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>{profile?.name || 'Utilisateur'}</h2>
                            <p style={{ color: '#666', fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>🎯</span> {GOAL_LABELS[profile?.goal || ''] || 'Définir un objectif'}
                            </p>
                            <div style={{
                                display: 'inline-flex', padding: '4px 10px', borderRadius: '10px',
                                background: profile?.subscription_tier === 'pro' ? 'rgba(99,102,241,0.15)' : profile?.subscription_tier === 'premium' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                                color: profile?.subscription_tier === 'pro' ? '#818cf8' : profile?.subscription_tier === 'premium' ? '#34d399' : '#888',
                                fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px', border: '0.5px solid rgba(255,255,255,0.08)',
                                textTransform: 'uppercase'
                            }}>
                                PLAN {(profile?.subscription_tier || 'FREE')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* BANNIÈRE UPGRADE DYNAMIQUE */}
                {profile?.subscription_tier !== 'premium' && (
                    <div
                        onClick={() => router.push('/upgrade')}
                        style={{
                            marginBottom: '28px',
                            padding: '18px',
                            borderRadius: '24px',
                            background: profile?.subscription_tier === 'pro' 
                                ? 'linear-gradient(135deg, #f59e0b, #6366f1)' 
                                : 'linear-gradient(135deg, #6366f1, #10b981)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            boxShadow: '0 12px 24px -10px rgba(99,102,241,0.5)',
                            transition: 'all 0.2s ease',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                {profile?.subscription_tier === 'pro' ? '⭐' : '🚀'}
                            </div>
                            <div>
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '800' }}>
                                    {profile?.subscription_tier === 'pro' ? 'Passez au Premium' : 'Débloquez vos bilans'}
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontWeight: '500' }}>
                                    {profile?.subscription_tier === 'pro' ? 'Débloquez Coach Kofi' : 'Scans illimités & Bilans →'}
                                </p>
                            </div>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>→</div>
                    </div>
                )}
            </div>

            {/* SECTION BILAN - TOTALEMENT RÉSERVÉE PRO/PREMIUM */}
            {profile?.subscription_tier !== 'free' && activeSlot && (bilanStatus === 'loading' || bilanStatus === 'done' || bilanStatus === 'empty') && (
                <div style={{ background: '#141414', border: `0.5px solid ${bilanStatus === 'loading' ? '#222' : (bilanColor + '40')}`, borderRadius: '16px', padding: '16px', margin: '0 20px 20px', position: 'relative', overflow: 'hidden' }}>
                    {bilanStatus === 'done' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: bilanColor }} />}

                    {bilanStatus === 'loading' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⏳</div>
                            <p style={{ color: '#555', fontSize: '13px', fontStyle: 'italic' }}>Génération du bilan...</p>
                        </div>
                    )}

                    {(bilanStatus === 'done' || bilanStatus === 'empty') && (
                        <>
                            {/* TITRE ET ÉMOJI */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${bilanColor}15`, border: `0.5px solid ${bilanColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{bilanEmoji}</div>
                                <div>
                                    <p style={{ color: '#fff', fontWeight: '600', fontSize: '15px' }}>{bilanTitle}</p>
                                    <p style={{ color: bilanColor, fontSize: '11px', marginTop: '1px' }}>{activeSlot === 'diner' ? 'Résumé de la journée' : `Créneau ${SLOT_LABELS[activeSlot]}`}</p>
                                </div>
                            </div>

                            {/* CONTENU SI BILAN DISPONIBLE */}
                            {bilanStatus === 'done' && (
                                <>
                                    {checkPermission(profile, 'hasCoachKofi') ? (
                                        bilanMessage && <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px', borderLeft: `2px solid ${bilanColor}40`, paddingLeft: '12px' }}>{bilanMessage}</p>
                                    ) : (
                                        <div style={{ marginBottom: '20px' }}>
                                            <p style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.5', marginBottom: '10px' }}>{autoMessage}</p>
                                            <div 
                                                onClick={() => router.push('/upgrade')}
                                                style={{ background: 'rgba(245,158,11,0.05)', borderRadius: '10px', padding: '10px', border: '0.5px dashed rgba(245,158,11,0.3)', cursor: 'pointer' }}>
                                                <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>💡 L'avantage Premium :</p>
                                                <p style={{ color: '#666', fontSize: '10px', lineHeight: '1.4', fontStyle: 'italic' }}>{kofiNudge} <span style={{ fontWeight: 'bold' }}>Débloquer →</span></p>
                                            </div>
                                        </div>
                                    )}

                                    {activeSlot === 'diner' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {stats.map(stat => (
                                                <div key={stat.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px', border: `0.5px solid ${stat.color}15` }}>
                                                    <p style={{ color: stat.color, fontSize: '16px', fontWeight: '600' }}>{Math.round(stat.current)}<span style={{ color: '#333', fontSize: '11px', fontWeight: '400' }}> / {stat.target}{stat.unit}</span></p>
                                                    <div style={{ width: '100%', height: '3px', background: '#1e1e1e', borderRadius: '2px', margin: '6px 0 4px' }}>
                                                        <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(100, Math.round((stat.current / stat.target) * 100))}%`, background: stat.color }} />
                                                    </div>
                                                    <p style={{ color: '#444', fontSize: '11px' }}>{stat.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        slots[activeSlot] && (
                                            <div style={{ background: '#0a0a0a', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `0.5px solid ${bilanColor}15` }}>
                                                <div>
                                                    <p style={{ color: bilanColor, fontSize: '17px', fontWeight: '700' }}>{Math.round(slots[activeSlot].consumed)}<span style={{ color: '#333', fontSize: '11px', fontWeight: '400' }}> / {slots[activeSlot].target} kcal</span></p>
                                                    <p style={{ color: '#444', fontSize: '11px', marginTop: '4px' }}>Calories {SLOT_LABELS[activeSlot]}</p>
                                                </div>
                                                <div style={{ width: '70px', height: '3px', background: '#1e1e1e', borderRadius: '2px' }}>
                                                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(100, Math.round((slots[activeSlot].consumed / slots[activeSlot].target) * 100))}%`, background: bilanColor }} />
                                                </div>
                                            </div>
                                        )
                                    )}
                                </>
                            )}

                            {/* SI VIDE */}
                            {bilanStatus === 'empty' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🍽️</div>
                                    <div>
                                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>Aucun repas détecté</p>
                                        <p style={{ color: '#444', fontSize: '11px' }}>Scannez vos plats pour voir le bilan {SLOT_LABELS[activeSlot]}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}



            <div style={{ padding: '0 20px' }}>

                <p style={{ color: '#444', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Aujourd'hui</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                    {stats.map((stat) => (
                        <div key={stat.label} style={{ background: '#141414', border: `0.5px solid ${stat.color}20`, borderRadius: '14px', padding: '14px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: stat.color }} />
                            <p style={{ color: stat.color, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                                {Math.round(stat.current)}<span style={{ color: '#333', fontSize: '12px', fontWeight: '400', marginLeft: '3px' }}>{stat.unit}</span>
                            </p>
                            <div style={{ width: '100%', height: '3px', background: '#1e1e1e', borderRadius: '2px', margin: '8px 0 6px' }}>
                                <div style={{ height: '100%', borderRadius: '2px', width: `${getProgressPercent(stat.current, stat.target)}%`, background: stat.color, transition: 'width 0.5s ease' }} />
                            </div>
                            <p style={{ color: '#444', fontSize: '11px' }}>{stat.label} · {stat.target}{stat.unit}</p>
                        </div>
                    ))}
                </div>

                <p style={{ color: '#444', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Mes informations</p>

                <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '14px', marginBottom: '16px', overflow: 'hidden' }}>
                    {[
                        { label: 'Âge', value: profile?.age ? `${profile.age} ans` : '—', icon: '👤' },
                        { label: 'Poids', value: profile?.weight_kg ? `${profile.weight_kg} kg` : '—', icon: '⚖️' },
                        { label: 'Taille', value: profile?.height_cm ? `${profile.height_cm} cm` : '—', icon: '📏' },
                        { label: 'Activité', value: profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—', icon: '⚡' },
                        { label: 'Objectif', value: profile?.goal ? GOAL_LABELS[profile.goal] : '—', icon: '🎯' },
                        { label: 'Pays', value: profile?.country || '—', icon: '🌍' },
                    ].map((item, i, arr) => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #1a1a1a' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '14px' }}>{item.icon}</span>
                                <span style={{ color: '#444', fontSize: '13px' }}>{item.label}</span>
                            </div>
                            <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
                    <>
                        <p style={{ color: '#444', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '20px 0 10px' }}>Cuisines préférées</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                            {profile.preferred_cuisines.map((c, i) => {
                                const color = STAT_COLORS[i % STAT_COLORS.length]
                                return (
                                    <span key={c} style={{ padding: '6px 14px', background: `${color}12`, border: `0.5px solid ${color}40`, borderRadius: '20px', color: color, fontSize: '12px', fontWeight: '500' }}>
                                        {c}
                                    </span>
                                )
                            })}
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={() => router.push('/onboarding')} style={{ flex: 1, height: '48px', background: 'linear-gradient(135deg, #6366f1, #10b981)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                        ✏️ Modifier
                    </button>
                    <button onClick={handleLogout} style={{ flex: 1, height: '48px', background: '#141414', border: '0.5px solid #222', borderRadius: '12px', color: '#555', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    )
}