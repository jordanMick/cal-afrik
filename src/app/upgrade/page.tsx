'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const plans = {
    mensuel: {
        pro: { price: '4 900', period: 'FCFA/mois' },
        premium: { price: '9 900', period: 'FCFA/mois' },
    },
    annuel: {
        pro: { price: '3 234', period: 'FCFA/mois' },
        premium: { price: '6 534', period: 'FCFA/mois' },
    },
}

export default function PricingPage() {
    const router = useRouter()
    const [isAnnuel, setIsAnnuel] = useState(false)
    const current = isAnnuel ? plans.annuel : plans.mensuel

    return (
        <div style={{
            minHeight: '100vh',
            background: '#080808',
            fontFamily: 'system-ui, sans-serif',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Halos fond */}
            <div style={{ position: 'fixed', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '0', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 24px 80px' }}>

                {/* LOGO */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '36px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🌍</div>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>Cal Afrik</span>
                </div>

                {/* TITRE */}
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '10px', letterSpacing: '-0.5px' }}>
                        Choisissez votre plan
                    </h1>
                    <p style={{ color: '#555', fontSize: '15px' }}>Mangez bien, suivez facilement — conçu pour l'Afrique</p>
                </div>

                {/* TOGGLE MENSUEL / ANNUEL */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
                    <span style={{ color: !isAnnuel ? '#fff' : '#555', fontSize: '14px', fontWeight: '500' }}>Mensuel</span>
                    <div
                        onClick={() => setIsAnnuel(!isAnnuel)}
                        style={{
                            width: '48px', height: '26px', borderRadius: '13px',
                            background: isAnnuel ? '#6366f1' : '#2a2a2a',
                            border: '0.5px solid #333',
                            cursor: 'pointer', position: 'relative',
                            transition: 'background 0.3s ease',
                        }}
                    >
                        <div style={{
                            position: 'absolute', top: '3px',
                            left: isAnnuel ? '25px' : '3px',
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: '#fff',
                            transition: 'left 0.3s ease',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }} />
                    </div>
                    <span style={{ color: isAnnuel ? '#fff' : '#555', fontSize: '14px', fontWeight: '500' }}>Annuel</span>
                    <div style={{
                        padding: '4px 10px', borderRadius: '20px',
                        background: 'rgba(16,185,129,0.15)',
                        border: '0.5px solid rgba(16,185,129,0.4)',
                        color: '#10b981', fontSize: '12px', fontWeight: '600',
                    }}>−34%</div>
                </div>

                {/* CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>

                    {/* ── GRATUIT ── */}
                    <div style={{
                        background: '#111',
                        border: '0.5px solid #2a2a2a',
                        borderRadius: '20px',
                        padding: '28px 24px',
                        display: 'flex', flexDirection: 'column', gap: '0',
                    }}>
                        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Gratuit</h2>
                        <div style={{ marginBottom: '6px' }}>
                            <span style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>0</span>
                            <span style={{ color: '#555', fontSize: '13px', marginLeft: '6px' }}>FCFA</span>
                        </div>
                        <p style={{ color: '#444', fontSize: '12px', marginBottom: '24px' }}>Pour toujours</p>
                        <div style={{ height: '0.5px', background: '#222', marginBottom: '20px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                            {[
                                { text: 'Scanner IA — 2 repas/jour', active: true },
                                { text: '100 plats africains', active: true },
                                { text: 'Journal calorique simple', active: true },
                                { text: 'Suivi du poids', active: true },
                                { text: 'Recalcul auto objectifs', active: false },
                                { text: 'Coach Kofi IA', active: false },
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.active ? '#555' : '#2a2a2a', flexShrink: 0 }} />
                                    <span style={{ color: f.active ? '#888' : '#333', fontSize: '13px', textDecoration: f.active ? 'none' : 'line-through' }}>{f.text}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => router.push('/onboarding')}
                            style={{
                                width: '100%', height: '48px',
                                background: 'transparent',
                                border: '0.5px solid #333',
                                borderRadius: '12px',
                                color: '#fff', fontSize: '14px', fontWeight: '600',
                                cursor: 'pointer',
                            }}>
                            Commencer →
                        </button>
                    </div>

                    {/* ── PRO ── */}
                    <div style={{
                        background: '#0d0d1a',
                        border: '1.5px solid #6366f1',
                        borderRadius: '20px',
                        padding: '28px 24px',
                        display: 'flex', flexDirection: 'column',
                        position: 'relative',
                        boxShadow: '0 0 40px rgba(99,102,241,0.15)',
                    }}>
                        {/* Badge */}
                        <div style={{
                            position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                            padding: '5px 18px', borderRadius: '20px',
                            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                            color: '#fff', fontSize: '12px', fontWeight: '600',
                            whiteSpace: 'nowrap',
                        }}>Recommandé</div>

                        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Pro</h2>
                        <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>{current.pro.price}</span>
                            <span style={{ color: '#555', fontSize: '13px' }}>{current.pro.period}</span>
                        </div>
                        <p style={{ color: '#444', fontSize: '12px', marginBottom: '24px', opacity: 0 }}>—</p>
                        <div style={{ height: '0.5px', background: '#2a2a2a', marginBottom: '20px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                            {[
                                'Scanner IA illimité',
                                '1 000+ plats africains',
                                'Recalcul auto des calories',
                                'Graphique de progression',
                                'Historique 6 mois',
                                'Sync cloud',
                                'Coach Kofi personnalisé',
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: i < 6 ? '#6366f1' : '#333', flexShrink: 0 }} />
                                    <span style={{ color: i < 6 ? '#ccc' : '#444', fontSize: '13px', textDecoration: i < 6 ? 'none' : 'line-through' }}>{f}</span>
                                </div>
                            ))}
                        </div>
                        <button style={{
                            width: '100%', height: '48px',
                            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                            border: 'none', borderRadius: '12px',
                            color: '#fff', fontSize: '14px', fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
                        }}>
                            Passer au Pro →
                        </button>
                    </div>

                    {/* ── PREMIUM ── */}
                    <div style={{
                        background: '#0a1a14',
                        border: '1.5px solid #10b981',
                        borderRadius: '20px',
                        padding: '28px 24px',
                        display: 'flex', flexDirection: 'column',
                        position: 'relative',
                        boxShadow: '0 0 40px rgba(16,185,129,0.12)',
                    }}>
                        {/* Badge */}
                        <div style={{
                            position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                            padding: '5px 18px', borderRadius: '20px',
                            background: 'linear-gradient(135deg, #10b981, #34d399)',
                            color: '#fff', fontSize: '12px', fontWeight: '600',
                            whiteSpace: 'nowrap',
                        }}>Premium</div>

                        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Premium</h2>
                        <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>{current.premium.price}</span>
                            <span style={{ color: '#555', fontSize: '13px' }}>{current.premium.period}</span>
                        </div>
                        <p style={{ color: '#444', fontSize: '12px', marginBottom: '24px', opacity: 0 }}>—</p>
                        <div style={{ height: '0.5px', background: '#1a2e24', marginBottom: '20px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                            {[
                                'Tout le plan Pro',
                                'Coach Kofi IA personnalisé',
                                'Plans repas hebdomadaires',
                                'Analyse nutritionnelle détaillée',
                                'Historique illimité',
                                'Accès prioritaire nouveautés',
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                                    <span style={{ color: '#ccc', fontSize: '13px' }}>{f}</span>
                                </div>
                            ))}
                        </div>
                        <button style={{
                            width: '100%', height: '48px',
                            background: 'linear-gradient(135deg, #10b981, #34d399)',
                            border: 'none', borderRadius: '12px',
                            color: '#fff', fontSize: '14px', fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                        }}>
                            Accéder au Premium →
                        </button>
                    </div>
                </div>

                {/* MOYENS DE PAIEMENT */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '40px' }}>
                    {['MTN Mobile Money', 'Orange Money', 'Wave', 'Carte bancaire'].map((p) => (
                        <div key={p} style={{
                            padding: '8px 16px',
                            background: '#111', border: '0.5px solid #2a2a2a',
                            borderRadius: '20px', color: '#555', fontSize: '12px', fontWeight: '500',
                        }}>{p}</div>
                    ))}
                </div>

                {/* FOOTER */}
                <p style={{ textAlign: 'center', color: '#333', fontSize: '12px', marginTop: '32px' }}>
                    Cal Afrik · Fait avec ❤️ pour l'Afrique
                </p>
            </div>
        </div>
    )
}