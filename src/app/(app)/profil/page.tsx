'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { getProgressPercent } from '@/lib/nutrition'
import { supabase } from '@/lib/supabase'

const GOAL_LABELS: Record<string, string> = {
    perdre: 'Perdre du poids',
    maintenir: 'Maintenir le poids',
    prendre: 'Prendre du poids',
}

const ACTIVITY_LABELS: Record<string, string> = {
    sedentaire: 'Sédentaire',
    leger: 'Légèrement actif',
    modere: 'Modérément actif',
    actif: 'Très actif',
    tres_actif: 'Extrêmement actif',
}

const card: React.CSSProperties = {
    background: '#161616',
    border: '0.5px solid #2a2a2a',
    borderRadius: '14px',
    padding: '14px',
    marginBottom: '10px',
}

export default function ProfilPage() {
    const router = useRouter()
    const {
        profile,
        dailyCalories, dailyProtein, dailyCarbs, dailyFat,
        bilanSeenDate, setBilanSeenDate,
        bilanMessage, setBilanMessage,
        bilanGoalReached, setBilanGoalReached,
        bilanExceeded, setBilanExceeded,
    } = useAppStore()

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65

    const now = new Date()
    const hour = now.getHours()
    const today = now.toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const isAfter23 = hour >= 23
    const isBefore8 = hour < 8
    const bilanDate = isBefore8 ? yesterday : today
    const hasBilan = (isAfter23 || isBefore8) && bilanSeenDate !== bilanDate

    const [showBilan, setShowBilan] = useState(
        hasBilan || (bilanSeenDate === bilanDate && !!bilanMessage && (isAfter23 || isBefore8))
    )
    const [bilanStatus, setBilanStatus] = useState<'loading' | 'done' | 'empty' | null>(
        bilanMessage ? 'done' : null
    )
    const [realDailyCalories, setRealDailyCalories] = useState(0)
    const [realDailyProtein, setRealDailyProtein] = useState(0)
    const [realDailyCarbs, setRealDailyCarbs] = useState(0)
    const [realDailyFat, setRealDailyFat] = useState(0)

    useEffect(() => {
        if (hasBilan) {
            setShowBilan(true)
            loadBilan()
        } else if (bilanSeenDate === bilanDate && bilanMessage && (isAfter23 || isBefore8)) {
            setShowBilan(true)
            setBilanStatus('done')
        }
    }, [])

    const loadBilan = async () => {
        if (bilanSeenDate === bilanDate && bilanMessage) { setBilanStatus('done'); return }
        setBilanStatus('loading')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/bilan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ calorieTarget, proteinTarget, carbsTarget, fatTarget, goal: profile?.goal || 'maintenir' })
            })
            const json = await res.json()
            if (!json.success) {
                setBilanMessage('Belle journée ! Reviens demain pour continuer. 💪')
                setBilanGoalReached(false); setBilanExceeded(false)
                setBilanStatus('done'); setBilanSeenDate(bilanDate)
                return
            }
            if (json.empty) { setBilanStatus('empty'); setBilanSeenDate(bilanDate); return }
            setRealDailyCalories(json.dailyCalories ?? 0)
            setRealDailyProtein(json.dailyProtein ?? 0)
            setRealDailyCarbs(json.dailyCarbs ?? 0)
            setRealDailyFat(json.dailyFat ?? 0)
            setBilanMessage(json.message)
            setBilanGoalReached(json.goalReached)
            setBilanExceeded(json.exceeded)
            setBilanStatus('done')
            setBilanSeenDate(bilanDate)
        } catch (err) {
            console.error(err)
            setBilanMessage('Belle journée ! Reviens demain pour continuer. 💪')
            setBilanGoalReached(false); setBilanExceeded(false)
            setBilanStatus('done'); setBilanSeenDate(bilanDate)
        }
    }

    const bilanEmoji = bilanGoalReached ? '🎉' : bilanExceeded ? '⚠️' : '📊'
    const bilanTitle = bilanGoalReached ? 'Objectif atteint !' : bilanExceeded ? 'Objectif dépassé' : 'Journée incomplète'

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>

            <div style={{ padding: '52px 20px 24px' }}>
                <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '500', marginBottom: '20px' }}>Mon profil</h1>

                {/* BILAN FIN DE JOURNÉE */}
                {showBilan && (
                    <div style={{
                        background: '#161616',
                        border: bilanStatus === 'empty' ? '0.5px solid #2a2a2a' : '0.5px solid #fff',
                        borderRadius: '16px',
                        padding: '16px',
                        marginBottom: '20px',
                    }}>
                        {bilanStatus === 'loading' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>⏳</span>
                                <p style={{ color: '#555', fontSize: '13px', fontStyle: 'italic' }}>
                                    Génération de ton bilan du jour...
                                </p>
                            </div>
                        )}
                        {bilanStatus === 'empty' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>🍽️</span>
                                <div>
                                    <p style={{ color: '#fff', fontWeight: '500', fontSize: '15px' }}>Aucun repas aujourd'hui</p>
                                    <p style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>Scanne tes repas pour obtenir un bilan personnalisé</p>
                                </div>
                            </div>
                        )}
                        {bilanStatus === 'done' && bilanMessage && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '24px' }}>{bilanEmoji}</span>
                                    <div>
                                        <p style={{ color: '#fff', fontWeight: '500', fontSize: '15px' }}>{bilanTitle}</p>
                                        <p style={{ color: '#555', fontSize: '12px' }}>Bilan du jour</p>
                                    </div>
                                </div>
                                <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>{bilanMessage}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {[
                                        { label: 'Calories', current: realDailyCalories, target: calorieTarget, unit: 'kcal' },
                                        { label: 'Protéines', current: realDailyProtein, target: proteinTarget, unit: 'g' },
                                        { label: 'Glucides', current: realDailyCarbs, target: carbsTarget, unit: 'g' },
                                        { label: 'Lipides', current: realDailyFat, target: fatTarget, unit: 'g' },
                                    ].map(stat => (
                                        <div key={stat.label} style={{ background: '#0a0a0a', borderRadius: '10px', padding: '10px' }}>
                                            <p style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>
                                                {stat.current}
                                                <span style={{ color: '#444', fontSize: '11px' }}> / {stat.target}{stat.unit}</span>
                                            </p>
                                            <div style={{ width: '100%', height: '2px', background: '#222', borderRadius: '2px', margin: '6px 0 4px' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '2px',
                                                    width: `${Math.min(100, Math.round((stat.current / stat.target) * 100))}%`,
                                                    background: '#fff'
                                                }} />
                                            </div>
                                            <p style={{ color: '#555', fontSize: '11px' }}>{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* AVATAR */}
                <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '50px', height: '50px', borderRadius: '14px',
                        background: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '20px', fontWeight: '500',
                        color: '#000', flexShrink: 0
                    }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                    <div>
                        <p style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{profile?.name || 'Utilisateur'}</p>
                        <p style={{ color: '#555', fontSize: '13px', marginTop: '2px' }}>
                            {profile?.country || '—'} · {profile?.goal ? GOAL_LABELS[profile.goal] : 'Objectif non défini'}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 20px' }}>

                <p style={{ color: '#444', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Aujourd'hui
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                    {[
                        { label: 'Calories', current: dailyCalories, target: calorieTarget, unit: 'kcal' },
                        { label: 'Protéines', current: dailyProtein, target: proteinTarget, unit: 'g' },
                        { label: 'Glucides', current: dailyCarbs, target: carbsTarget, unit: 'g' },
                        { label: 'Lipides', current: dailyFat, target: fatTarget, unit: 'g' },
                    ].map((stat) => (
                        <div key={stat.label} style={card}>
                            <p style={{ color: '#fff', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.5px' }}>
                                {Math.round(stat.current)}
                                <span style={{ color: '#444', fontSize: '12px', fontWeight: '400', marginLeft: '3px' }}>{stat.unit}</span>
                            </p>
                            <div style={{ width: '100%', height: '2px', background: '#222', borderRadius: '2px', margin: '8px 0 6px' }}>
                                <div style={{
                                    height: '100%', borderRadius: '2px',
                                    width: `${getProgressPercent(stat.current, stat.target)}%`,
                                    background: '#fff', transition: 'width 0.5s ease'
                                }} />
                            </div>
                            <p style={{ color: '#444', fontSize: '11px' }}>{stat.label} · {stat.target}{stat.unit}</p>
                        </div>
                    ))}
                </div>

                <p style={{ color: '#444', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Mes informations
                </p>

                <div style={{ background: '#161616', border: '0.5px solid #2a2a2a', borderRadius: '14px', marginBottom: '16px', overflow: 'hidden' }}>
                    {[
                        { label: 'Âge', value: profile?.age ? `${profile.age} ans` : '—' },
                        { label: 'Poids', value: profile?.weight_kg ? `${profile.weight_kg} kg` : '—' },
                        { label: 'Taille', value: profile?.height_cm ? `${profile.height_cm} cm` : '—' },
                        { label: 'Activité', value: profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—' },
                        { label: 'Objectif', value: profile?.goal ? GOAL_LABELS[profile.goal] : '—' },
                        { label: 'Pays', value: profile?.country || '—' },
                    ].map((item, i, arr) => (
                        <div key={item.label} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '13px 16px',
                            borderBottom: i < arr.length - 1 ? '0.5px solid #1e1e1e' : 'none'
                        }}>
                            <span style={{ color: '#555', fontSize: '13px' }}>{item.label}</span>
                            <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {/* CUISINES */}
                {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
                    <>
                        <p style={{ color: '#444', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '20px 0 10px' }}>
                            Cuisines préférées
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                            {profile.preferred_cuisines.map((c) => (
                                <span key={c} style={{
                                    padding: '6px 14px',
                                    background: '#161616', border: '0.5px solid #333',
                                    borderRadius: '20px', color: '#fff', fontSize: '12px', fontWeight: '500'
                                }}>
                                    {c}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                {/* BOUTONS */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={() => router.push('/onboarding')} style={{
                        flex: 1, height: '48px',
                        background: '#fff', border: 'none',
                        borderRadius: '12px', color: '#000', fontWeight: '500', fontSize: '14px', cursor: 'pointer'
                    }}>
                        ✏️ Modifier
                    </button>
                    <button onClick={handleLogout} style={{
                        flex: 1, height: '48px',
                        background: '#161616', border: '0.5px solid #2a2a2a',
                        borderRadius: '12px', color: '#555', fontWeight: '500', fontSize: '14px', cursor: 'pointer'
                    }}>
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    )
}