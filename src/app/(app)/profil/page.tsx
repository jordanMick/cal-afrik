'use client'

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
    const { profile, dailyCalories, dailyProtein, dailyCarbs, dailyFat } = useAppStore()

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65

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
        <div style={{
            minHeight: '100vh',
            background: '#0F0A06',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            paddingBottom: '100px',
        }}>

            {/* Décor */}
            <div style={{
                position: 'fixed', top: '-60px', left: '-60px',
                width: '240px', height: '240px', borderRadius: '50%',
                background: 'radial-gradient(circle, #2D6A4F33, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />

            {/* Header */}
            <div style={{
                padding: '52px 24px 28px',
                position: 'relative', zIndex: 1,
            }}>
                <h1 style={{
                    color: '#fff', fontSize: '28px',
                    fontWeight: '800', letterSpacing: '-0.5px',
                    marginBottom: '24px',
                }}>
                    Mon profil
                </h1>

                {/* Avatar card */}
                <div style={{
                    ...cardStyle,
                    display: 'flex', alignItems: 'center', gap: '16px',
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: '#C4622D',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '24px', fontWeight: '800', color: '#fff',
                        flexShrink: 0,
                    }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                    <div>
                        <p style={{ color: '#fff', fontSize: '18px', fontWeight: '800' }}>
                            {profile?.name || 'Utilisateur'}
                        </p>
                        <p style={{ color: '#555', fontSize: '13px', marginTop: '4px' }}>
                            {profile?.country || '—'} •{' '}
                            {profile?.goal ? GOAL_LABELS[profile.goal] : 'Objectif non défini'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats du jour */}
            <div style={{ padding: '0 24px', position: 'relative', zIndex: 1 }}>
                <p style={{
                    color: '#555', fontSize: '12px', fontWeight: '700',
                    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px'
                }}>
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
                                <span style={{ color: '#555', fontSize: '13px', fontWeight: '400', marginLeft: '3px' }}>
                                    {stat.unit}
                                </span>
                            </p>
                            <div style={{
                                width: '100%', height: '3px',
                                background: '#2A1F14', borderRadius: '2px',
                                margin: '10px 0 6px',
                            }}>
                                <div style={{
                                    height: '100%', borderRadius: '2px',
                                    width: `${getProgressPercent(stat.current, stat.target)}%`,
                                    background: stat.color,
                                    transition: 'width 0.6s ease',
                                }} />
                            </div>
                            <p style={{ color: '#555', fontSize: '11px' }}>
                                {stat.label} · objectif {stat.target}{stat.unit}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Infos */}
                <p style={{
                    color: '#555', fontSize: '12px', fontWeight: '700',
                    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px'
                }}>
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
                        <div key={item.label} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px 20px',
                            borderBottom: i < arr.length - 1 ? '1px solid #2A1F14' : 'none',
                        }}>
                            <span style={{ color: '#555', fontSize: '14px' }}>{item.label}</span>
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {/* Cuisines */}
                {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
                    <>
                        <p style={{
                            color: '#555', fontSize: '12px', fontWeight: '700',
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            margin: '24px 0 12px'
                        }}>
                            Cuisines préférées
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                            {profile.preferred_cuisines.map((c) => (
                                <span key={c} style={{
                                    padding: '8px 16px',
                                    background: '#1A1108',
                                    border: '1px solid #C4622D',
                                    borderRadius: '20px',
                                    color: '#C4622D', fontSize: '13px', fontWeight: '600',
                                }}>
                                    {c}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                {/* Boutons */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '20px'
                }}>
                    <button
                        onClick={() => router.push('/onboarding')}
                        style={{
                            flex: 1,
                            height: '50px',
                            background: '#1A1108',
                            border: '1px solid #2A1F14',
                            borderRadius: '14px',
                            color: '#fff',
                            fontWeight: '700',
                        }}
                    >
                        ✏️ Modifier
                    </button>

                    <button
                        onClick={handleLogout}
                        style={{
                            flex: 1,
                            height: '50px',
                            background: '#1A1108',
                            border: 'none',
                            borderRadius: '14px',
                            color: '#fff',
                            fontWeight: '700',
                        }}
                    >
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    )
}