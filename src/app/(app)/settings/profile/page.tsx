'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const GOAL_LABELS: Record<string, string> = { perdre: 'Perdre du poids', maintenir: 'Maintenir le poids', prendre: 'Prendre du poids' }
const ACTIVITY_LABELS: Record<string, string> = { sedentaire: 'Sédentaire', leger: 'Légèrement actif', modere: 'Modérément actif', actif: 'Très actif', tres_actif: 'Extrêmement actif' }
const STAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']

export default function PersonalInfoPage() {
    const router = useRouter()
    const { profile } = useAppStore()

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Infos personnelles</h1>
            </div>

            <div style={{ padding: '0 20px', marginTop: '10px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Mes données</p>

                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden' }}>
                    {[
                        { label: 'Âge', value: profile?.age ? `${profile.age} ans` : '—', icon: '👤' },
                        { label: 'Sexe', value: profile?.gender === 'femme' ? 'Femme' : 'Homme', icon: '🚻' },
                        { label: 'Pays', value: profile?.country || '—', icon: '🌍' },
                        { label: 'Poids', value: profile?.weight_kg ? `${profile.weight_kg} kg` : '—', icon: '⚖️' },
                        { label: 'Poids cible', value: profile?.goal_weight_kg ? `${profile.goal_weight_kg} kg` : '—', icon: '🎯' },
                        { label: 'Taille', value: profile?.height_cm ? `${profile.height_cm} cm` : '—', icon: '📏' },
                        { label: 'Activité', value: profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—', icon: '⚡' },
                        { label: 'Objectif', value: profile?.goal ? GOAL_LABELS[profile.goal] : '—', icon: '📈' },
                    ].map((item, i, arr) => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border-color)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{item.label}</span>
                            </div>
                            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
                    <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Cuisines préférées</p>
                        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                            {profile.preferred_cuisines.map((c, i) => {
                                const color = STAT_COLORS[i % STAT_COLORS.length]
                                return (
                                    <span key={c} style={{ padding: '8px 16px', background: `${color}12`, border: `0.5px solid ${color}40`, borderRadius: '20px', color: color, fontSize: '13px', fontWeight: '600' }}>
                                        {c}
                                    </span>
                                )
                            })}
                        </div>
                    </>
                )}

                {profile?.dietary_restrictions && profile.dietary_restrictions.length > 0 && (
                    <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Restrictions & Allergies</p>
                        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
                            {profile.dietary_restrictions.map((r, i) => (
                                <span key={r} style={{ padding: '8px 16px', background: 'rgba(var(--danger-rgb), 0.1)', border: '0.5px solid rgba(var(--danger-rgb), 0.4)', borderRadius: '20px', color: 'var(--danger)', fontSize: '13px', fontWeight: '600' }}>
                                    {r}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                <button
                    onClick={() => router.push('/onboarding?edit=1')}
                    style={{ width: '100%', padding: '16px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' }}
                >
                    <Pencil size={18} />
                    Mettre à jour mes informations
                </button>
            </div>
        </div>
    )
}