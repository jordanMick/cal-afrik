'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { Gift, X, Sparkles } from 'lucide-react'

export default function SurpriseManager() {
    const { profile, surpriseStatus, setSurpriseStatus } = useAppStore()
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState(1) // 1: Intro, 2: Wheel, 3: Result
    const [rotation, setRotation] = useState(0)
    const [isSpinning, setIsSpinning] = useState(false)
    const router = useRouter()

    useEffect(() => {
        // Apparaît immédiatement pour les comptes gratuits et si aucune surprise n'a été gérée
        if (profile?.subscription_tier === 'free' && surpriseStatus === 'none') {
            setSurpriseStatus('pending')
        }
    }, [profile, surpriseStatus, setSurpriseStatus])

    if (surpriseStatus !== 'pending' && surpriseStatus !== 'shown') return null

    const handleOpen = () => {
        setIsOpen(true)
        setStep(1)
        if (surpriseStatus === 'pending') setSurpriseStatus('shown')
    }

    const spinWheel = () => {
        if (isSpinning) return
        setIsSpinning(true)
        
        // On veut tomber sur 10%. 
        // L'image montre : 10% à gauche (Orange), 5% à droite (Pale Orange)
        // Conic gradient part du haut (0deg). 
        // 0-180: Pale Orange (Droite)
        // 180-360: Orange (Gauche)
        // Le milieu du 10% (Gauche) est à 270deg.
        // Pour amener 270deg en haut (0deg), on doit ajouter 90deg (ou soustraire 270).
        const tours = 8
        const targetAngle = 90 // Amène le milieu de la zone gauche en haut
        const newRotation = (360 * tours) + targetAngle + (Math.random() * 20 - 10) // Petit aléatoire pour le réalisme
        setRotation(newRotation)

        setTimeout(() => {
            setIsSpinning(false)
            setStep(3)
        }, 4000)
    }

    const applyReduction = () => {
        setSurpriseStatus('claimed')
        setIsOpen(false)
        router.push('/upgrade?discount=10')
    }

    return (
        <>
            {/* BANNIÈRE SUR LE DASHBOARD */}
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
                <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}
                >
                    →
                </motion.div>
            </motion.div>

            {/* MODAL SEQUENCE */}
            <AnimatePresence>
                {isOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                        />
                        
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                background: 'var(--bg-primary)',
                                width: '100%',
                                maxWidth: '400px',
                                borderRadius: '32px',
                                padding: '40px 30px',
                                position: 'relative',
                                textAlign: 'center',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                border: '1px solid var(--border-color)'
                            }}
                        >
                            <button 
                                onClick={() => setIsOpen(false)}
                                style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                                <X size={20} />
                            </button>

                            {step === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎁</div>
                                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '12px' }}>Tu as un cadeau !</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                                        On a préparé une surprise rien que pour toi. Tente ta chance pour obtenir un avantage exclusif !
                                    </p>
                                    <button
                                        onClick={() => setStep(2)}
                                        style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)' }}
                                    >
                                        Découvrir ma surprise
                                    </button>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>Une réduction spéciale pour toi</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '40px' }}>Tourne la roue et découvre ton cadeau</p>
                                    
                                    <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto 40px' }}>
                                        {/* Indicateur (Flèche en haut) */}
                                        <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, color: '#10b981' }}>
                                            <div style={{ width: 0, height: 0, borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderTop: '25px solid currentColor' }} />
                                        </div>

                                        <motion.div
                                            animate={{ rotate: rotation }}
                                            transition={{ duration: 4, ease: [0.45, 0.05, 0.55, 0.95] }}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                borderRadius: '50%',
                                                background: 'conic-gradient(#e1fcf0 0deg 180deg, #10b981 180deg 360deg)',
                                                position: 'relative',
                                                border: '8px solid var(--bg-secondary)',
                                                boxShadow: '0 0 30px rgba(0,0,0,0.2)'
                                            }}
                                        >
                                            {/* 5% (Zone claire à droite) */}
                                            <div style={{ position: 'absolute', top: '50%', left: '75%', transform: 'translate(-50%, -50%) rotate(90deg)', color: '#10b981', fontWeight: '900', fontSize: '24px' }}>5%</div>
                                            {/* 10% (Zone verte à gauche) */}
                                            <div style={{ position: 'absolute', top: '50%', left: '25%', transform: 'translate(-50%, -50%) rotate(-90deg)', color: '#fff', fontWeight: '900', fontSize: '24px' }}>10%</div>
                                            
                                            {/* Centre */}
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
                                                <div style={{ color: '#10b981', fontWeight: '900', fontSize: '18px' }}>🌎</div>
                                            </div>
                                        </motion.div>
                                    </div>

                                    <button
                                        onClick={spinWheel}
                                        disabled={isSpinning}
                                        style={{ width: '100%', padding: '18px', background: isSpinning ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: isSpinning ? 'default' : 'pointer', boxShadow: isSpinning ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.3)' }}
                                    >
                                        {isSpinning ? 'Ça tourne...' : 'Tourner la roue'}
                                    </button>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                                    <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎉</div>
                                    <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#10b981', marginBottom: '12px' }}>Félicitations !</h2>
                                    <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                                        Tu as gagné une réduction de 10%
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
                                        Profite du plan Pro ou Premium à prix réduit dès maintenant.
                                    </p>
                                    <button
                                        onClick={applyReduction}
                                        style={{ width: '100%', padding: '18px', background: '#10b981', border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)' }}
                                    >
                                        Appliquer la réduction
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
