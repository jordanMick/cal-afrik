'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'
import { toast } from 'sonner'

// Plus besoin de déclarer FedaPay car nous utilisons une redirection directe vers Maketou

const plans = {
    pro: { price: '100', period: 'FCFA/mois', value: 'pro' },
    premium: { price: '100', period: 'FCFA/mois', value: 'premium' },
}

function PricingContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { profile } = useAppStore()
    const [loading, setLoading] = useState<string | null>(null)
    const effectiveTier = getEffectiveTier(profile)
    const currentTier = effectiveTier
    const hideFree = searchParams.get('hideFree') === 'true'

    // Plus besoin de charger le script FedaPay ici car Maketou utilise une redirection simple
    useEffect(() => {
        // Nettoyage si nécessaire
    }, []);

    const handleSubscribe = async (tier: 'pro' | 'premium') => {
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
                body: JSON.stringify({ tier })
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
            background: '#080808',
            fontFamily: 'system-ui, sans-serif',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{ position: 'fixed', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '0', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ maxWidth: visibleCards === 1 ? '400px' : '960px', margin: '0 auto', padding: '60px 24px 80px' }}>

                {/* LOGO */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '36px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🌍</div>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>Cal Afrik</span>
                </div>

                {/* TITRE */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '10px', letterSpacing: '-0.5px' }}>
                        {currentTier === 'premium' ? 'Votre abonnement' : 'Améliorez votre expérience'}
                    </h1>
                    <p style={{ color: '#555', fontSize: '15px' }}>Mangez bien, suivez facilement — conçu pour l'Afrique</p>
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
                            background: '#111',
                            border: '0.5px solid #2a2a2a',
                            borderRadius: '20px',
                            padding: '28px 24px',
                            display: 'flex', flexDirection: 'column', gap: '0', opacity: 0.8
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
                                    { text: 'Journal alimentaire de base', active: true },
                                    { text: '2 Scans Photo / jour', active: true },
                                    { text: 'Base locale (35+ aliments)', active: true },
                                    { text: 'Calcul des besoins (kcal/macros)', active: true },
                                    { text: 'Support technique WhatsApp', active: true },
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#555', flexShrink: 0 }} />
                                        <span style={{ color: '#888', fontSize: '13px' }}>{f.text}</span>
                                    </div>
                                ))}
                            </div>
                            <button style={{ width: '100%', height: '48px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid #333', borderRadius: '12px', color: '#666', fontSize: '14px', fontWeight: '600', cursor: 'default' }}>
                                Plan actuel
                            </button>
                        </div>
                    )}

                    {/* ── PRO ── */}
                    {showPro && (
                        <div style={{
                            background: '#0d0d1a',
                            border: currentTier === 'pro' ? '1.5px solid #333' : '1.5px solid #6366f1',
                            borderRadius: '20px',
                            padding: '28px 24px',
                            display: 'flex', flexDirection: 'column',
                            position: 'relative',
                            boxShadow: currentTier === 'pro' ? 'none' : '0 0 40px rgba(99,102,241,0.15)',
                            opacity: currentTier === 'pro' ? 0.9 : 1
                        }}>
                            {currentTier !== 'pro' && (
                                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', padding: '5px 18px', borderRadius: '20px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>Recommandé</div>
                            )}

                            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Pro</h2>
                            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>{plans.pro.price}</span>
                                <span style={{ color: '#555', fontSize: '13px' }}>{plans.pro.period}</span>
                            </div>
                            <div style={{ height: '0.5px', background: '#2a2a2a', margin: '20px 0' }} />
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
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentTier === 'pro' ? '#444' : '#6366f1', flexShrink: 0 }} />
                                        <span style={{ color: currentTier === 'pro' ? '#888' : '#ccc', fontSize: '13px' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                disabled={loading !== null || currentTier === 'pro'}
                                onClick={() => handleSubscribe('pro')}
                                style={{ width: '100%', height: '48px', background: currentTier === 'pro' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #818cf8)', border: currentTier === 'pro' ? '0.5px solid #333' : 'none', borderRadius: '12px', color: currentTier === 'pro' ? '#666' : '#fff', fontSize: '14px', fontWeight: '600', cursor: (loading || currentTier === 'pro') ? 'default' : 'pointer', boxShadow: currentTier === 'pro' ? 'none' : '0 4px 20px rgba(99,102,241,0.35)' }}>
                                {loading === 'pro' ? 'Initialisation...' : currentTier === 'pro' ? 'Plan actuel' : 'Passer au Pro →'}
                            </button>
                        </div>
                    )}

                    {/* ── PREMIUM ── */}
                    {showPremium && (
                        <div style={{
                            background: '#0a1a14',
                            border: currentTier === 'premium' ? '1.5px solid #333' : '1.5px solid #10b981',
                            borderRadius: '20px',
                            padding: '28px 24px',
                            display: 'flex', flexDirection: 'column',
                            position: 'relative',
                            boxShadow: currentTier === 'premium' ? 'none' : '0 0 40px rgba(16,185,129,0.12)',
                        }}>
                            {currentTier !== 'premium' && (
                                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', padding: '5px 18px', borderRadius: '20px', background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>Elite</div>
                            )}

                            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Premium</h2>
                            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>{plans.premium.price}</span>
                                <span style={{ color: '#555', fontSize: '13px' }}>{plans.premium.period}</span>
                            </div>
                            <div style={{ height: '0.5px', background: '#1a2e24', margin: '20px 0' }} />
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
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentTier === 'premium' ? '#444' : '#10b981', flexShrink: 0 }} />
                                        <span style={{ color: currentTier === 'premium' ? '#888' : '#ccc', fontSize: '13px' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                disabled={loading !== null || currentTier === 'premium'}
                                onClick={() => handleSubscribe('premium')}
                                style={{ width: '100%', height: '48px', background: currentTier === 'premium' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #34d399)', border: currentTier === 'premium' ? '0.5px solid #333' : 'none', borderRadius: '12px', color: currentTier === 'premium' ? '#666' : '#fff', fontSize: '14px', fontWeight: '600', cursor: (loading || currentTier === 'premium') ? 'default' : 'pointer', boxShadow: currentTier === 'premium' ? 'none' : '0 4px 20px rgba(16,185,129,0.3)' }}>
                                {loading === 'premium' ? 'Initialisation...' : currentTier === 'premium' ? 'Plan actuel' : 'Accéder au Premium →'}
                            </button>
                        </div>
                    )}

                    {/* ── UNITAIRE (SCAN) ── */}
                    {showFree && (
                        <div style={{
                            background: '#1a1005',
                            border: '1.5px solid #f59e0b',
                            borderRadius: '20px',
                            padding: '28px 24px',
                            display: 'flex', flexDirection: 'column',
                            position: 'relative',
                            boxShadow: '0 0 40px rgba(245,158,11,0.08)',
                        }}>
                             <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', padding: '5px 18px', borderRadius: '20px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#fff', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>À l'unité</div>

                            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Scan IA</h2>
                            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>100</span>
                                <span style={{ color: '#555', fontSize: '13px' }}>FCFA</span>
                            </div>
                            <p style={{ color: '#444', fontSize: '12px', marginBottom: '24px' }}>Par scan supplémentaire</p>
                            <div style={{ height: '0.5px', background: '#2a2a2a', margin: '20px 0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', flex: 1 }}>
                                {[
                                    '1 Scan IA de ton assiette',
                                    'Analyse nutritionnelle complète',
                                    'Conseils de Coach Yao inclus',
                                    'Utilisable quand tu veux',
                                    'Pas d\'abonnement récurrent',
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                                        <span style={{ color: '#ccc', fontSize: '13px' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                disabled={loading !== null}
                                onClick={() => handleSubscribe('scan' as any)}
                                style={{ width: '100%', height: '48px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: loading ? 'default' : 'pointer', boxShadow: '0 4px 20px rgba(245,158,11,0.3)' }}>
                                {loading === 'scan' ? 'Initialisation...' : 'Acheter 1 scan →'}
                            </button>
                        </div>
                    )}
                </div>

                {/* MOYENS DE PAIEMENT */}
                {currentTier !== 'premium' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '60px' }}>
                        <p style={{ color: '#444', fontSize: '13px', fontWeight: '500' }}>Paiement sécurisé via Maketou</p>
                        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            {['MTN', 'Orange', 'Moov', 'Wave', 'Visa', 'Mastercard'].map((p) => (
                                <div key={p} style={{ padding: '8px 20px', background: '#111', border: '0.5px solid #222', borderRadius: '14px', color: '#666', fontSize: '12px', fontWeight: '600' }}>{p}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Plus besoin du conteneur FedaPay */}

                {/* FOOTER */}
                <p style={{ textAlign: 'center', color: '#333', fontSize: '12px', marginTop: '48px' }}>
                    Cal Afrik · Fait avec ❤️ pour l'Afrique
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