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

    // ✅ Vraies valeurs du jour — viennent de l'API bilan (source de vérité = BD)
    // On les stocke localement pour l'affichage dans le bilan
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
        if (bilanSeenDate === bilanDate && bilanMessage) {
            setBilanStatus('done')
            return
        }

        setBilanStatus('loading')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // ✅ On n'envoie PLUS les valeurs du store — l'API relit depuis la BD
            const res = await fetch('/api/bilan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    calorieTarget,
                    proteinTarget,
                    carbsTarget,
                    fatTarget,
                    goal: profile?.goal || 'maintenir',
                })
            })

            const json = await res.json()

            if (!json.success) {
                setBilanMessage('Belle journée ! Reviens demain pour continuer. 💪')
                setBilanGoalReached(false)
                setBilanExceeded(false)
                setBilanStatus('done')
                setBilanSeenDate(bilanDate)
                return
            }

            // ✅ Cas aucun repas aujourd'hui
            if (json.empty) {
                setBilanStatus('empty')
                setBilanSeenDate(bilanDate)
                return
            }

            // ✅ On utilise les totaux retournés par l'API (calculés depuis la BD)
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
            setBilanGoalReached(false)
            setBilanExceeded(false)
            setBilanStatus('done')
            setBilanSeenDate(bilanDate)
        }
    }

    const bilanColor = bilanGoalReached ? '#52B788' : bilanExceeded ? '#E24B4A' : '#E9C46A'
    const bilanEmoji = bilanGoalReached ? '🎉' : bilanExceeded ? '⚠️' : '📊'
    const bilanTitle = bilanGoalReached ? 'Objectif atteint !' : bilanExceeded ? 'Objectif dépassé' : 'Journée incomplète'

    const cardStyle = {
        background: '#1A1108',
        border: '1px solid #2A1F14',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '16px',
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0F0A06', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>

            <div style={{ padding: '52px 24px 28px', position: 'relative', zIndex: 1 }}>
                <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '24px' }}>
                    Mon profil
                </h1>

                {/* ─── BILAN FIN DE JOURNÉE ─── */}
                {showBilan && (
                    <div style={{
                        background: '#1A1108',
                        border: `1px solid ${bilanStatus === 'empty' ? '#2A1F14' : bilanColor + '44'}`,
                        borderRadius: '20px',
                        padding: '20px',
                        marginBottom: '24px',
                    }}>
                        {/* ✅ Cas chargement */}
                        {bilanStatus === 'loading' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>⏳</span>
                                <p style={{ color: '#777', fontSize: '13px', fontStyle: 'italic' }}>
                                    Génération de ton bilan du jour...
                                </p>
                            </div>
                        )}

                        {/* ✅ Cas aucun repas */}
                        {bilanStatus === 'empty' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '28px' }}>🍽️</span>
                                <div>
                                    <p style={{ color: '#E9C46A', fontWeight: '800', fontSize: '16px' }}>
                                        Aucun repas aujourd'hui
                                    </p>
                                    <p style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>
                                        Scanne tes repas pour obtenir un bilan personnalisé
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ✅ Cas bilan disponible */}
                        {bilanStatus === 'done' && bilanMessage && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '28px' }}>{bilanEmoji}</span>
                                    <div>
                                        <p style={{ color: bilanColor, fontWeight: '800', fontSize: '16px' }}>{bilanTitle}</p>
                                        <p style={{ color: '#555', fontSize: '12px' }}>Bilan du jour</p>
                                    </div>
                                </div>

                                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
                                    {bilanMessage}
                                </p>

                                {/* ✅ Stats depuis la BD (pas le store) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {[
                                        { label: 'Calories', current: realDailyCalories, target: calorieTarget, unit: 'kcal', color: bilanColor },
                                        { label: 'Protéines', current: realDailyProtein, target: proteinTarget, unit: 'g', color: '#52B788' },
                                        { label: 'Glucides', current: realDailyCarbs, target: carbsTarget, unit: 'g', color: '#E9C46A' },
                                        { label: 'Lipides', current: realDailyFat, target: fatTarget, unit: 'g', color: '#888' },
                                    ].map(stat => (
                                        <div key={stat.label} style={{ background: '#0F0A06', borderRadius: '12px', padding: '12px' }}>
                                            <p style={{ color: stat.color, fontSize: '18px', fontWeight: '800' }}>
                                                {stat.current}
                                                <span style={{ color: '#555', fontSize: '11px' }}> / {stat.target}{stat.unit}</span>
                                            </p>
                                            <div style={{ width: '100%', height: '3px', background: '#2A1F14', borderRadius: '2px', margin: '6px 0 4px' }}>
                                                <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(100, Math.round((stat.current / stat.target) * 100))}%`, background: stat.color }} />
                                            </div>
                                            <p style={{ color: '#555', fontSize: '11px' }}>{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Avatar */}
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#C4622D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                    <div>
                        <p style={{ color: '#fff', fontSize: '18px', fontWeight: '800' }}>{profile?.name || 'Utilisateur'}</p>
                        <p style={{ color: '#555', fontSize: '13px', marginTop: '4px' }}>
                            {profile?.country || '—'} • {profile?.goal ? GOAL_LABELS[profile.goal] : 'Objectif non défini'}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 24px', position: 'relative', zIndex: 1 }}>

                {/* Stats du jour — depuis le store (temps réel) */}
                <p style={{ color: '#555', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Aujourd'hui
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    {[
                        { label: 'Calories', current: dailyCalories, target: calorieTarget, unit: 'kcal', color: '#C4622D' },
                        { label: 'Protéines', current: dailyProtein, target: proteinTarget, unit: 'g', color: '#52B788' },
                        { label: 'Glucides', current: dailyCarbs, target: carbsTarget, unit: 'g', color: '#E9C46A' },
                        { label: 'Lipides', current: dailyFat, target: fatTarget, unit: 'g', color: '#888' },
                    ].map((stat) => (
                        <div key={stat.label} style={cardStyle}>
                            <p style={{ color: '#fff', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                                {Math.round(stat.current)}
                                <span style={{ color: '#555', fontSize: '13px', fontWeight: '400', marginLeft: '3px' }}>{stat.unit}</span>
                            </p>
                            <div style={{ width: '100%', height: '3px', background: '#2A1F14', borderRadius: '2px', margin: '10px 0 6px' }}>
                                <div style={{ height: '100%', borderRadius: '2px', width: `${getProgressPercent(stat.current, stat.target)}%`, background: stat.color, transition: 'width 0.6s ease' }} />
                            </div>
                            <p style={{ color: '#555', fontSize: '11px' }}>{stat.label} · objectif {stat.target}{stat.unit}</p>
                        </div>
                    ))}
                </div>

                {/* Infos */}
                <p style={{ color: '#555', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Mes informations
                </p>

                <div style={{ ...cardStyle, padding: '0' }}>
                    {[
                        { label: 'Âge', value: profile?.age ? `${profile.age} ans` : '—' },
                        { label: 'Poids', value: profile?.weight_kg ? `${profile.weight_kg} kg` : '—' },
                        { label: 'Taille', value: profile?.height_cm ? `${profile.height_cm} cm` : '—' },
                        { label: 'Activité', value: profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—' },
                        { label: 'Objectif', value: profile?.goal ? GOAL_LABELS[profile.goal] : '—' },
                        { label: 'Pays', value: profile?.country || '—' },
                    ].map((item, i, arr) => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < arr.length - 1 ? '1px solid #2A1F14' : 'none' }}>
                            <span style={{ color: '#555', fontSize: '14px' }}>{item.label}</span>
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {/* Cuisines */}
                {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
                    <>
                        <p style={{ color: '#555', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '24px 0 12px' }}>
                            Cuisines préférées
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                            {profile.preferred_cuisines.map((c) => (
                                <span key={c} style={{ padding: '8px 16px', background: '#1A1108', border: '1px solid #C4622D', borderRadius: '20px', color: '#C4622D', fontSize: '13px', fontWeight: '600' }}>
                                    {c}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                {/* Boutons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button onClick={() => router.push('/onboarding')}
                        style={{ flex: 1, height: '50px', background: '#1A1108', border: '1px solid #2A1F14', borderRadius: '14px', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>
                        ✏️ Modifier
                    </button>
                    <button onClick={handleLogout}
                        style={{ flex: 1, height: '50px', background: '#1A1108', border: 'none', borderRadius: '14px', color: '#ff6b6b', fontWeight: '700', cursor: 'pointer' }}>
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    )
}