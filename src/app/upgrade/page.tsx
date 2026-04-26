'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'
import { toast } from 'sonner'

// Plus besoin de déclarer FedaPay car nous utilisons une redirection directe vers Maketou

const durations = [
    { value: '1', label: '1 mois', discount: null },
    { value: '3', label: '3 mois', discount: '-10%' },
    { value: '12', label: '12 mois', discount: '-25%' },
]

const plans = {
    pro: {
        '1': 1500,
        '3': 4000,
        '12': 14000
    },
    premium: {
        '1': 2500,
        '3': 6500,
        '12': 22000
    }
}

function PricingContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { profile } = useAppStore()
    const [loading, setLoading] = useState<string | null>(null)
    const effectiveTier = getEffectiveTier(profile)
    const currentTier = effectiveTier
    const hideFree = searchParams.get('hideFree') === 'true'
    const discountParam = searchParams.get('discount')
    const discount = discountParam ? parseInt(discountParam) : 0
    const [promoInput, setPromoInput] = useState('')
    const [isApplying, setIsApplying] = useState(false)
    const [promoOpen, setPromoOpen] = useState(false)
    const [duration, setDuration] = useState<'1' | '3' | '12'>('1')

    // Plus besoin de charger le script FedaPay ici car Maketou utilise une redirection simple
    useEffect(() => {
        // Nettoyage si nécessaire
    }, []);

    const handleSubscribe = async (tier: 'pro' | 'premium' | 'scan') => {
        if (currentTier === tier) return;

        setLoading(tier);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ tier, discount, duration: parseInt(duration) })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                const errorMsg = data.error || 'Erreur inconnue';
                throw new Error(errorMsg);
            }

            // Redirection directe vers la page de paiement Maketou
            if (data.url) {
                // Sauvegarder l'ID du panier pour la page de succès
                if (data.cartId) {
                    localStorage.setItem('pending_maketou_cart_id', data.cartId);
                }
                window.location.href = data.url;
            } else {
                throw new Error('URL de paiement non reçue');
            }

        } catch (error: any) {
            console.error('Erreur de paiement:', error);
            toast.error(`Erreur: ${error.message}`);
        } finally {
            setLoading(null);
        }
    }

    const showFree = currentTier === 'free' && !hideFree
    const showPro = currentTier === 'free' || currentTier === 'pro'
    const showPremium = true
    const visibleCards = (showFree ? 1 : 0) + (showPro ? 1 : 0) + (showPremium ? 1 : 0)

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: 'var(--text-primary)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{ position: 'fixed', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '0', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--success-rgb),0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ maxWidth: visibleCards === 1 ? '400px' : '960px', margin: '0 auto', padding: '60px 24px 80px' }}>

                {/* LOGO */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '36px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--accent), var(--success))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 8px 24px rgba(var(--success-rgb), 0.2)' }}>🌍</div>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>Cal Afrik</span>
                </div>

                {/* TITRE */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <h1 style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.5px' }}>
                        {currentTier === 'premium' ? 'Votre abonnement' : 'Améliorez votre expérience'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Mangez bien, suivez facilement — conçu pour l'Afrique</p>
                </div>

                {discount > 0 && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px dashed #10b981',
                        borderRadius: '16px',
                        padding: '12px 20px',
                        marginBottom: '32px',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}>
                        <span style={{ fontSize: '20px' }}>🎁</span>
                        <p style={{ color: '#10b981', fontWeight: '700', fontSize: '14px' }}>
                            Réduction de {discount}% appliquée sur tous les plans !
                        </p>
                    </div>
                )}

                {/* SELECTEUR DE DURÉE */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '40px',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '4px',
                    borderRadius: '16px',
                    maxWidth: '360px',
                    margin: '0 auto 48px',
                    border: '1px solid rgba(255,255,255,0.06)'
                }}>
                    {durations.map((d) => (
                        <button
                            key={d.value}
                            onClick={() => setDuration(d.value as any)}
                            style={{
                                flex: 1,
                                padding: '12px 0',
                                borderRadius: '12px',
                                border: 'none',
                                background: duration === d.value ? 'var(--bg-tertiary)' : 'transparent',
                                color: duration === d.value ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            {d.label}
                            {d.discount && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-4px',
                                    background: '#10b981',
                                    color: '#fff',
                                    fontSize: '9px',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontWeight: '800'
                                }}>
                                    {d.discount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        .pricing-grid {
                            grid-template-columns: 1fr !important;
                        }
                    }
                `}</style>

                {/* CARDS GRID */}
                <div
                    className="pricing-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: visibleCards === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '16px',
                        alignItems: 'start'
                    }}
                >

                    {/* ── GRATUIT ── */}
                    {showFree && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '0.5px solid var(--border-color)',
                            borderRadius: '20px',
                            padding: '28px 24px',
                            display: 'flex', flexDirection: 'column', gap: '0', opacity: 0.8
                        }}>
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Gratuit</h2>
                            <div style={{ marginBottom: '6px' }}>
                                <span style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)' }}>0</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '6px' }}>FCFA</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '24px' }}>Pour toujours</p>
                            <div style={{ height: '0.5px', background: 'var(--border-color)', marginBottom: '20px' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                                {[
                                    { text: 'Journal alimentaire de base', active: true },
                                    { text: '2 Scans Photo / jour', active: true },
                                    { text: 'Base locale (35+ aliments)', active: true },
                                    { text: 'Calcul des besoins (kcal/macros)', active: true },
                                    { text: 'Analyses nutritionnelles IA', active: true },
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{f.text}</span>
                                    </div>
                                ))}
                            </div>
                            <button style={{ width: '100%', height: '48px', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', cursor: 'default' }}>
                                Plan actuel
                            </button>
                        </div>
                    )}

                    {/* ── PRO ── */}
                    {showPro && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: currentTier === 'pro' ? '1.5px solid var(--border-color)' : '1.5px solid var(--accent)',
                            borderRadius: '24px',
                            padding: '32px 24px',
                            display: 'flex', flexDirection: 'column',
                            position: 'relative',
                            boxShadow: currentTier === 'pro' ? 'none' : '0 20px 50px rgba(var(--accent-rgb),0.12)',
                            opacity: currentTier === 'pro' ? 0.9 : 1,
                            transition: 'transform 0.3s'
                        }}>
                            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', padding: '6px 20px', borderRadius: '20px', background: 'linear-gradient(135deg, var(--accent), #60a5fa)', color: '#fff', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)' }}>
                                {currentTier === 'pro' ? 'Votre Plan' : 'Populaire'}
                            </div>

                            <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Pro</h2>
                            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontWeight: '800', color: 'var(--text-primary)', textDecoration: discount > 0 ? 'line-through' : 'none', opacity: discount > 0 ? 0.4 : 1, fontSize: discount > 0 ? '24px' : '36px' }}>{plans.pro[duration]}</span>
                                {discount > 0 && (
                                    <span style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)' }}>{Math.round(plans.pro[duration] * (1 - discount / 100))}</span>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>FCFA / {duration === '1' ? 'mois' : duration === '3' ? '3 mois' : 'an'}</span>
                            </div>

                            {/* PRIX MENSUEL ÉQUIVALENT PRO */}
                            {duration !== '1' && (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '12px', fontWeight: '500' }}>
                                    (soit {duration === '3' ? Math.round(plans.pro[duration] / 3) : Math.round(plans.pro[duration] / 12)} FCFA / mois)
                                </p>
                            )}

                            {/* ÉCONOMIE PRO */}
                            {duration !== '1' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <span style={{ background: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                                        📉 Éco. {duration === '3' ? '500' : '4 000'} FCFA
                                    </span>
                                </div>
                            )}

                            <div style={{ height: '0.5px', background: 'var(--border-color)', margin: '16px 0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                                {[
                                    'Scans Photo ILLIMITÉS',
                                    'Graphiques de progression (6 mois)',
                                    'Recalcul auto des objectifs',
                                    'Historique détaillé sur 6 mois',
                                    'Sync cloud & Sécurité',
                                    'Conseils de Coach Yao',
                                    'Notifications push dynamiques'
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentTier === 'pro' ? 'var(--text-muted)' : 'var(--accent)', flexShrink: 0 }} />
                                        <span style={{ color: currentTier === 'pro' ? 'var(--text-muted)' : 'var(--text-secondary)', fontSize: '13px' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                disabled={loading !== null || currentTier === 'pro'}
                                onClick={() => handleSubscribe('pro')}
                                style={{ width: '100%', height: '52px', background: currentTier === 'pro' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent), #60a5fa)', border: currentTier === 'pro' ? '1px solid var(--border-color)' : 'none', borderRadius: '14px', color: currentTier === 'pro' ? 'var(--text-muted)' : '#fff', fontSize: '14px', fontWeight: '700', cursor: (loading || currentTier === 'pro') ? 'default' : 'pointer', boxShadow: currentTier === 'pro' ? 'none' : '0 8px 24px rgba(var(--accent-rgb),0.3)' }}>
                                {loading === 'pro' ? 'Initialisation...' : currentTier === 'pro' ? 'Plan actuel' : 'Passer au Pro'}
                            </button>
                        </div>
                    )}

                    {/* ── PREMIUM ── */}
                    {showPremium && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: currentTier === 'premium' ? '1.5px solid var(--border-color)' : '1.5px solid var(--success)',
                            borderRadius: '24px',
                            padding: '32px 24px',
                            display: 'flex', flexDirection: 'column',
                            position: 'relative',
                            boxShadow: currentTier === 'premium' ? 'none' : '0 25px 60px rgba(var(--success-rgb),0.15)',
                            transition: 'transform 0.3s'
                        }}>
                            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', padding: '6px 20px', borderRadius: '20px', background: 'linear-gradient(135deg, var(--success), #34d399)', color: '#fff', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(var(--success-rgb), 0.3)' }}>
                                {currentTier === 'premium' ? 'Votre Plan' : 'Meilleure Offre'}
                            </div>

                            <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Premium</h2>
                            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontWeight: '800', color: 'var(--text-primary)', textDecoration: discount > 0 ? 'line-through' : 'none', opacity: discount > 0 ? 0.4 : 1, fontSize: discount > 0 ? '24px' : '36px' }}>{plans.premium[duration]}</span>
                                {discount > 0 && (
                                    <span style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)' }}>{Math.round(plans.premium[duration] * (1 - discount / 100))}</span>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>FCFA / {duration === '1' ? 'mois' : duration === '3' ? '3 mois' : 'an'}</span>
                            </div>

                            {/* PRIX MENSUEL ÉQUIVALENT PREMIUM */}
                            {duration !== '1' && (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '12px', fontWeight: '500' }}>
                                    (soit {duration === '3' ? Math.round(plans.premium[duration] / 3) : Math.round(plans.premium[duration] / 12)} FCFA / mois)
                                </p>
                            )}

                            {/* ÉCONOMIE PREMIUM */}
                            {duration !== '1' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <span style={{ background: 'rgba(var(--success-rgb), 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                                        🔥 Éco. {duration === '3' ? '1 000' : '8 000'} FCFA
                                    </span>
                                </div>
                            )}

                            <div style={{ height: '0.5px', background: 'var(--border-color)', margin: '16px 0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                                {[
                                    'Tout le contenu du Plan PRO',
                                    'Menus Hebdomadaires Personnalisés',
                                    'Accès aux menus futurs (7 jours)',
                                    'Historique ILLIMITÉ',
                                    'Bilan Nutritionnel Hebdomadaire Expert',
                                    'Accès prioritaire aux nouveautés',
                                    'Coach Yao personnel illimité',
                                    'Alertes contextuelles avancées'
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentTier === 'premium' ? 'var(--text-muted)' : 'var(--success)', flexShrink: 0 }} />
                                        <span style={{ color: currentTier === 'premium' ? 'var(--text-muted)' : 'var(--text-secondary)', fontSize: '13px' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                disabled={loading !== null || currentTier === 'premium'}
                                onClick={() => handleSubscribe('premium')}
                                style={{ width: '100%', height: '52px', background: currentTier === 'premium' ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--success), #34d399)', border: currentTier === 'premium' ? '1px solid var(--border-color)' : 'none', borderRadius: '14px', color: currentTier === 'premium' ? 'var(--text-muted)' : '#fff', fontSize: '14px', fontWeight: '700', cursor: (loading || currentTier === 'premium') ? 'default' : 'pointer', boxShadow: currentTier === 'premium' ? 'none' : '0 8px 24px rgba(var(--success-rgb),0.3)' }}>
                                {loading === 'premium' ? 'Initialisation...' : currentTier === 'premium' ? 'Plan actuel' : 'Accéder au Premium'}
                            </button>
                        </div>
                    )}

                </div>

                {/* CODE PROMO SECTION (Premium Redesign) */}
                {!discount && (
                    <div style={{ marginTop: '48px', textAlign: 'center' }}>
                        {!promoOpen ? (
                            <button
                                onClick={() => setPromoOpen(true)}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1.5px dashed var(--border-color)',
                                    borderRadius: '16px',
                                    padding: '12px 24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    margin: '0 auto',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                <span style={{ fontSize: '20px' }}>🎁</span>
                                <span style={{ fontSize: '14px', fontWeight: '600' }}>J'ai un code privilège</span>
                            </button>
                        ) : (
                            <div style={{
                                animation: 'fadeIn 0.4s ease-out',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '24px',
                                padding: '24px',
                                maxWidth: '380px',
                                margin: '0 auto',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Decorative elements for voucher look */}
                                <div style={{ position: 'absolute', top: '50%', left: '-12px', width: '24px', height: '24px', background: 'var(--bg-primary)', borderRadius: '50%', transform: 'translateY(-50%)', border: '1px solid var(--border-color)' }} />
                                <div style={{ position: 'absolute', top: '50%', right: '-12px', width: '24px', height: '24px', background: 'var(--bg-primary)', borderRadius: '50%', transform: 'translateY(-50%)', border: '1px solid var(--border-color)' }} />

                                <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>Coupon Privilège</h3>

                                <div style={{ position: 'relative', marginBottom: '16px' }}>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={promoInput}
                                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                                        placeholder="EX: CALAFRIK24"
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-primary)',
                                            border: '2px dashed var(--border-color)',
                                            borderRadius: '14px',
                                            padding: '16px',
                                            color: 'var(--text-primary)',
                                            fontSize: '18px',
                                            fontWeight: '800',
                                            letterSpacing: '4px',
                                            textAlign: 'center',
                                            outline: 'none',
                                            transition: 'border-color 0.3s'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => setPromoOpen(false)}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            background: 'transparent',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '12px',
                                            color: 'var(--text-secondary)',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (promoInput === profile?.promo_code) {
                                                const userDiscount = (profile as any)?.promo_discount || 10
                                                setIsApplying(true)
                                                setTimeout(() => {
                                                    router.push(`/upgrade?discount=${userDiscount}`)
                                                    setIsApplying(false)
                                                    toast.success(`Réduction de ${userDiscount}% appliquée ! 🎊`)
                                                }, 1200)
                                            } else {
                                                toast.error('Code invalide ou expiré')
                                            }
                                        }}
                                        disabled={isApplying || !promoInput}
                                        style={{
                                            flex: 2,
                                            padding: '14px',
                                            background: promoInput ? 'linear-gradient(135deg, var(--accent), var(--success))' : 'var(--bg-tertiary)',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            fontSize: '14px',
                                            fontWeight: '700',
                                            cursor: promoInput ? 'pointer' : 'default',
                                            transition: 'all 0.3s',
                                            opacity: isApplying ? 0.7 : 1,
                                            boxShadow: promoInput ? '0 8px 20px rgba(var(--success-rgb), 0.2)' : 'none'
                                        }}
                                    >
                                        {isApplying ? 'Validation...' : 'Activer'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MOYENS DE PAIEMENT */}
                {currentTier !== 'premium' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '40px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>Paiement sécurisé via Maketou</p>
                        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            {['MTN', 'Orange', 'Moov', 'Wave', 'Visa', 'Mastercard'].map((p) => (
                                <div key={p} style={{ padding: '8px 20px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>{p}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* FOOTER */}
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '32px' }}>
                    Cal Afrik · Nutrition africaine intelligente 🧠
                </p>
            </div>
        </div>
    )
}

export default function PricingPage() {
    return (
        <Suspense fallback={<div style={{ background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Chargement...</div>}>
            <PricingContent />
        </Suspense>
    )
}
