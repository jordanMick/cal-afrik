'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { Gift, X, Sparkles, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// Segments de la roue avec leur probabilité et position (degrés de début)
// La roue fait : 0°-120° = 5%, 120°-360° = 10%
const WHEEL_SEGMENTS = [
    { label: '5%',  discount: 5,  color: '#e1fcf0', textColor: '#10b981', start: 0,   end: 120 },
    { label: '10%', discount: 10, color: '#10b981', textColor: '#fff',    start: 120, end: 360 },
]

export default function SurpriseManager() {
    const { profile, surpriseStatus, setSurpriseStatus, refreshProfile } = useAppStore()
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [rotation, setRotation] = useState(0)
    const [isSpinning, setIsSpinning] = useState(false)
    const [wonDiscount, setWonDiscount] = useState<number>(10)
    const [copied, setCopied] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (profile?.subscription_tier === 'free' && surpriseStatus === 'none') {
            setSurpriseStatus('pending')
        }
    }, [profile, surpriseStatus, setSurpriseStatus])

    // Bannière dashboard : afficher si pending/shown ET que l'utilisateur a un code promo
    const showBanner = (surpriseStatus === 'pending' || surpriseStatus === 'shown') && !!(profile?.promo_code)
    // Bannière pré-roue : si pending/shown ET pas encore de code  
    const showPreWheelBanner = (surpriseStatus === 'pending' || surpriseStatus === 'shown') && !(profile?.promo_code)

    if (surpriseStatus === 'claimed') return null
    if (!showBanner && !showPreWheelBanner) return null

    const handleOpen = () => {
        setIsOpen(true)
        setStep(profile?.promo_code ? 3 : 1)
        if (surpriseStatus === 'pending') setSurpriseStatus('shown')
    }

    const handleDismissBanner = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSurpriseStatus('claimed')
    }

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(profile?.promo_code || '')
        setCopied(true)
        toast.success('Code copié !')
        setTimeout(() => setCopied(false), 2000)
    }

    const spinWheel = () => {
        if (isSpinning) return
        setIsSpinning(true)

        // Probabilité : 1/3 de chance de 5%, 2/3 de chance de 10%
        const rand = Math.random()
        let won: typeof WHEEL_SEGMENTS[0]
        let targetAngleMid: number

        if (rand < 0.5) {
            won = WHEEL_SEGMENTS[0] // 5% → milieu à 90°
            targetAngleMid = 90
        } else {
            won = WHEEL_SEGMENTS[1] // 10% → milieu à 270°
            targetAngleMid = 270
        }

        // Pour amener targetAngleMid en haut (0°), on tourne de (360 - targetAngleMid)
        const toTop = (360 - targetAngleMid) % 360
        const tours = 7
        const finalRotation = 360 * tours + toTop + (Math.random() * 10 - 5)

        setRotation(finalRotation)
        setWonDiscount(won.discount)

        setTimeout(async () => {
            setIsSpinning(false)
            setStep(3)

            // Sauvegarder dans le profil
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                await supabase
                    .from('user_profiles')
                    .update({ promo_discount: won.discount })
                    .eq('user_id', session.user.id)
                await refreshProfile()
            }
        }, 4500)
    }

    const applyReduction = () => {
        const discount = profile?.promo_discount || wonDiscount
        setSurpriseStatus('claimed')
        setIsOpen(false)
        router.push(`/upgrade?discount=${discount}`)
    }

    const discount = profile?.promo_discount || wonDiscount

    return (
        <>
            {/* BANNIÈRE DASHBOARD */}
            {showBanner && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={handleOpen}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #10b981)',
                        padding: '16px 20px',
                        borderRadius: '24px',
                        marginBottom: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 30px rgba(99, 102, 241, 0.2)',
                        position: 'relative',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '14px' }}>
                            <Gift color="#fff" size={20} />
                        </div>
                        <div>
                            <p style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>Ta réduction de {profile?.promo_discount || discount}% 🎁</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>Code :</p>
                                <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900', letterSpacing: '1px', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '6px' }}>
                                    {profile?.promo_code}
                                </span>
                                <button onClick={handleCopy} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismissBanner}
                        style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    >
                        <X size={16} />
                    </button>
                </motion.div>
            )}

            {/* BANNIÈRE PRÉ-ROUE */}
            {showPreWheelBanner && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleOpen}
                    style={{
                        background: 'linear-gradient(135deg, #10b981, #34d399)',
                        padding: '16px 20px',
                        borderRadius: '20px',
                        marginBottom: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.2 }}>
                        <Sparkles size={60} color="#fff" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1 }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '14px' }}>
                            <Gift color="#fff" size={24} />
                        </div>
                        <div>
                            <p style={{ color: '#fff', fontSize: '14px', fontWeight: '800' }}>On t'a préparé une surprise !</p>
                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>Clique ici pour découvrir ton cadeau 🎁</p>
                        </div>
                    </div>
                    <motion.div animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>
                        →
                    </motion.div>
                </motion.div>
            )}

            {/* MODAL */}
            <AnimatePresence>
                {isOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: '400px', borderRadius: '32px', padding: '40px 30px', position: 'relative', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}
                        >
                            <button onClick={() => setIsOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>

                            {/* ÉTAPE 1 : Intro */}
                            {step === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎁</div>
                                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '12px' }}>Tu as un cadeau !</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                                        On a préparé une surprise rien que pour toi. Tente ta chance pour obtenir une réduction exclusive !
                                    </p>
                                    <button onClick={() => setStep(2)} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)' }}>
                                        Découvrir ma surprise
                                    </button>
                                </motion.div>
                            )}

                            {/* ÉTAPE 2 : Roue */}
                            {step === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>Tente ta chance !</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Tourne la roue pour découvrir ta réduction</p>

                                    <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto 32px' }}>
                                        {/* Flèche indicateur */}
                                        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, color: '#10b981' }}>
                                            <div style={{ width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '22px solid currentColor' }} />
                                        </div>
                                        <motion.div
                                            animate={{ rotate: rotation }}
                                            transition={{ duration: 4.5, ease: [0.45, 0.05, 0.55, 0.95] }}
                                            style={{
                                                width: '100%', height: '100%', borderRadius: '50%',
                                                /* 120° pour 5% (1/3), 240° pour 10% (2/3) */
                                                background: 'conic-gradient(#e1fcf0 0deg 180deg, #10b981 180deg 360deg)',
                                                position: 'relative', border: '8px solid var(--bg-secondary)',
                                                boxShadow: '0 0 30px rgba(0,0,0,0.2)'
                                            }}
                                        >
                                            {/* Labels */}
                                            <div style={{ position: 'absolute', top: '22%', left: '50%', transform: 'translateX(-50%)', color: '#10b981', fontWeight: '900', fontSize: '22px' }}>5%</div>
                                            <div style={{ position: 'absolute', top: '62%', left: '50%', transform: 'translateX(-50%)', color: '#fff', fontWeight: '900', fontSize: '22px' }}>10%</div>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '56px', height: '56px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', fontSize: '24px' }}>🌍</div>
                                        </motion.div>
                                    </div>

                                    <button onClick={spinWheel} disabled={isSpinning}
                                        style={{ width: '100%', padding: '18px', background: isSpinning ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: isSpinning ? 'default' : 'pointer', boxShadow: isSpinning ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.3)' }}>
                                        {isSpinning ? 'Ça tourne...' : 'Tourner la roue'}
                                    </button>
                                </motion.div>
                            )}

                            {/* ÉTAPE 3 : Résultat + code */}
                            {step === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                                    <div style={{ fontSize: '72px', marginBottom: '16px' }}>🎉</div>
                                    <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#10b981', marginBottom: '8px' }}>Félicitations !</h2>
                                    <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
                                        Tu as gagné {profile?.promo_discount || wonDiscount}% de réduction !
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                                        Utilise ce code pour en profiter maintenant ou plus tard.
                                    </p>

                                    {/* Code promo affiché */}
                                    {profile?.promo_code && (
                                        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '16px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ textAlign: 'left' }}>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Ton code promo</p>
                                                <p style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '900', letterSpacing: '3px' }}>{profile.promo_code}</p>
                                            </div>
                                            <button onClick={handleCopy} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#818cf8', fontWeight: '700', fontSize: '12px' }}>
                                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                                {copied ? 'Copié !' : 'Copier'}
                                            </button>
                                        </div>
                                    )}

                                    <button onClick={applyReduction} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)', marginBottom: '12px' }}>
                                        Appliquer la réduction →
                                    </button>
                                    <button onClick={() => setIsOpen(false)} style={{ width: '100%', padding: '14px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
                                        Utiliser mon code plus tard
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
