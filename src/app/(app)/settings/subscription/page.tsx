'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Zap, Crown, Star, RefreshCw, ArrowUpCircle, ScanLine, TrendingUp } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier, SUBSCRIPTION_RULES } from '@/lib/subscription'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

const TIER_CONFIG = {
    free: {
        label: 'FREE',
        icon: <Star size={22} color="var(--text-muted)" />,
        color: 'var(--text-muted)',
        bg: 'rgba(var(--text-muted-rgb), 0.1)',
        border: 'rgba(var(--text-muted-rgb), 0.2)',
        gradient: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
        textColor: 'var(--text-primary)',
    },
    pro: {
        label: 'PRO',
        icon: <Zap size={22} color="var(--accent)" />,
        color: 'var(--accent)',
        bg: 'rgba(var(--accent-rgb), 0.1)',
        border: 'rgba(var(--accent-rgb), 0.25)',
        gradient: 'linear-gradient(135deg, var(--accent), #4f46e5)',
        textColor: '#fff',
    },
    premium: {
        label: 'PREMIUM',
        icon: <Crown size={22} color="var(--warning)" />,
        color: 'var(--warning)',
        bg: 'rgba(var(--warning-rgb), 0.1)',
        border: 'rgba(var(--warning-rgb), 0.25)',
        gradient: 'linear-gradient(135deg, var(--warning), #d97706)',
        textColor: '#fff',
    },
}

const PLAN_FEATURES: Record<string, { label: string; free: string; pro: string; premium: string }[]> = {
    features: [
        { label: 'Scans / jour', free: '2', pro: 'Illimité', premium: 'Illimité' },
        { label: 'Messages Coach Yao', free: '2', pro: '10', premium: '30' },
        { label: 'Conseil scanner', free: '1x à vie', pro: '1 / jour', premium: 'Illimité' },
        { label: 'Graphique de poids', free: '8 sem', pro: '6 mois', premium: '1 an' },
        { label: 'Recalcul auto calories', free: '✗', pro: '✓', premium: '✓' },
    ]
}

export default function SubscriptionPage() {
    const router = useRouter()
    const { profile } = useAppStore()
    const [renewing, setRenewing] = useState(false)

    const effectiveTier = getEffectiveTier(profile)
    const config = TIER_CONFIG[effectiveTier]

    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
    const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null
    const isExpiringSoon = daysLeft !== null && daysLeft <= 7

    const rules = SUBSCRIPTION_RULES[effectiveTier]
    const today = new Date().toISOString().split('T')[0]
    const usedScans = (profile as any)?.last_usage_reset_date === today ? ((profile as any)?.scans_today || 0) : 0

    const handleRenew = async () => {
        setRenewing(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            // Redirige vers la page d'upgrade avec le plan actuel pré-sélectionné
            router.push(`/upgrade?plan=${effectiveTier}`)
        } finally {
            setRenewing(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', position: 'relative', overflow: 'hidden' }}>
            {/* Halo */}
            <div style={{ position: 'fixed', top: '-80px', right: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: `radial-gradient(circle, ${config.color}15 0%, transparent 70%)`, pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{ padding: '52px 20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', lineHeight: 1 }}>Mon abonnement</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>Gérer votre plan Cal-Afrik</p>
                </div>
            </div>

            <div style={{ padding: '0 20px' }}>

                {/* Carte plan actuel */}
                <div style={{
                    background: config.gradient,
                    borderRadius: '24px',
                    padding: '24px',
                    marginBottom: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: `0 8px 32px ${config.color}20`,
                }}>
                    <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <p style={{ color: effectiveTier === 'free' ? 'var(--text-muted)' : 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Plan actuel</p>
                                <p style={{ color: config.textColor || '#fff', fontSize: '32px', fontWeight: '900', letterSpacing: '-1px', marginTop: '4px' }}>{config.label}</p>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '14px', padding: '10px' }}>
                                {config.icon}
                            </div>
                        </div>

                        {/* Statut expiration */}
                        {expiresAt && effectiveTier !== 'free' ? (
                            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Expire le</p>
                                    <p style={{ color: '#fff', fontSize: '14px', fontWeight: '700', marginTop: '2px' }}>
                                        {expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ color: isExpiringSoon ? 'var(--warning)' : 'rgba(255,255,255,0.5)', fontSize: '22px', fontWeight: '900' }}>{daysLeft}</p>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>jours restants</p>
                                </div>
                            </div>
                        ) : effectiveTier === 'free' ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Accès gratuit — limité</p>
                        ) : null}
                    </div>
                </div>

                {/* Usage du jour */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Utilisation aujourd'hui</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', padding: '16px 20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(var(--accent-rgb), 0.1)', borderRadius: '10px', padding: '8px' }}>
                                <ScanLine size={18} color="var(--accent)" />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600' }}>Scans aujourd'hui</p>
                                <p style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', marginTop: '2px' }}>
                                    {usedScans}
                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '400' }}>
                                        {Number(rules.maxScansPerDay) >= 1000 ? ' / ∞' : ` / ${rules.maxScansPerDay}`}
                                    </span>
                                </p>
                            </div>
                        </div>
                        {Number(rules.maxScansPerDay) < 1000 && (
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ color: usedScans >= Number(rules.maxScansPerDay) ? 'var(--danger)' : 'var(--accent)', fontSize: '22px', fontWeight: '900' }}>
                                    {Math.max(0, Number(rules.maxScansPerDay) - usedScans)}
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>restants</p>
                            </div>
                        )}
                    </div>
                    {Number(rules.maxScansPerDay) < 1000 && (
                        <div style={{ height: '3px', background: 'var(--bg-tertiary)', borderRadius: '2px', marginTop: '14px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (usedScans / Number(rules.maxScansPerDay)) * 100)}%`, background: usedScans >= Number(rules.maxScansPerDay) ? 'var(--danger)' : 'var(--accent)', borderRadius: '2px' }} />
                        </div>
                    )}
                </div>

                {/* Tableau comparatif */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Ce que vous avez</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden', marginBottom: '24px' }}>
                    {/* Header colonnes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: '0.5px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700' }}>Fonctionnalité</p>
                        {(['free', 'pro', 'premium'] as const).map(t => (
                            <p key={t} style={{ color: t === effectiveTier ? config.color : 'var(--text-muted)', fontSize: '10px', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase' }}>{t}</p>
                        ))}
                    </div>
                    {PLAN_FEATURES.features.map((f, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < PLAN_FEATURES.features.length - 1 ? '0.5px solid var(--border-color)' : 'none', alignItems: 'center', opacity: 1 }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{f.label}</p>
                            {(['free', 'pro', 'premium'] as const).map(t => (
                                <p key={t} style={{ color: t === effectiveTier ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '11px', fontWeight: t === effectiveTier ? '700' : '400', textAlign: 'center', opacity: t === effectiveTier ? 1 : 0.5 }}>
                                    {f[t]}
                                </p>
                            ))}
                        </div>
                    ))}
                </div>

                {/* CTA selon le plan */}
                {effectiveTier === 'free' ? (
                    <button
                        onClick={() => router.push('/upgrade')}
                        style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, var(--accent), var(--success))', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.3)', marginBottom: '12px' }}
                    >
                        <ArrowUpCircle size={20} />
                        Passer au plan Pro
                    </button>
                ) : (
                    <button
                        onClick={handleRenew}
                        disabled={renewing}
                        style={{ 
                            width: '100%', padding: '18px', 
                            background: renewing ? 'var(--bg-tertiary)' : config.gradient, 
                            color: renewing ? 'var(--text-muted)' : (config.textColor || '#fff'), 
                            border: 'none', borderRadius: '20px', fontSize: '16px', fontWeight: '800', 
                            cursor: renewing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: '10px', boxShadow: `0 8px 24px ${config.color}25`, marginBottom: '12px' 
                        }}
                    >
                        <RefreshCw size={20} />
                        {renewing ? 'Redirection...' : 'Renouveler mon abonnement'}
                    </button>
                )}

                {effectiveTier === 'pro' && (
                    <button
                        onClick={() => router.push('/upgrade?plan=premium')}
                        style={{ width: '100%', padding: '14px', background: 'transparent', border: '0.5px solid rgba(var(--warning-rgb), 0.3)', borderRadius: '16px', color: 'var(--warning)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Crown size={16} />
                        Passer au Premium →
                    </button>
                )}
            </div>
        </div>
    )
}