'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share, PlusSquare, Download } from 'lucide-react'

export default function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false)
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

    useEffect(() => {
        // 1. Vérifier si l'app est déjà installée
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
        if (isStandalone) return

        // 2. Vérifier si l'utilisateur a déjà fermé le prompt récemment
        const lastPrompt = localStorage.getItem('pwa-prompt-closed')
        if (lastPrompt) {
            const lastDate = new Date(lastPrompt)
            const now = new Date()
            const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            if (diffDays < 3) return // Ne pas montrer avant 3 jours
        }

        // 3. Détecter la plateforme
        const userAgent = window.navigator.userAgent.toLowerCase()
        if (/iphone|ipad|ipod/.test(userAgent)) {
            setPlatform('ios')
            // Délai pour ne pas agresser au chargement
            setTimeout(() => setShowPrompt(true), 3000)
        } else if (/android/.test(userAgent)) {
            setPlatform('android')
        }

        // 4. Écouter l'événement d'installation Android/Chrome
        const handler = (e: any) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setShowPrompt(true)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
            setShowPrompt(false)
        }
        setDeferredPrompt(null)
    }

    const closePrompt = () => {
        setShowPrompt(false)
        localStorage.setItem('pwa-prompt-closed', new Date().toISOString())
    }

    if (!showPrompt) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '20px',
                    right: '20px',
                    zIndex: 9999,
                    maxWidth: '440px',
                    margin: '0 auto',
                }}
            >
                <div style={{
                    background: 'rgba(var(--bg-secondary-rgb), 0.9)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '24px',
                    padding: '20px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Décoration */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <div style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '14px', 
                            background: 'linear-gradient(135deg, var(--accent), var(--success))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            boxShadow: '0 8px 16px rgba(var(--accent-rgb), 0.3)',
                            flexShrink: 0
                        }}>
                            🥗
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                Installer Cal-Afrik
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                Ajoute l'app sur ton écran d'accueil pour un accès rapide et une expérience fluide.
                            </p>
                        </div>
                        <button 
                            onClick={closePrompt}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {platform === 'ios' ? (
                        <div style={{ 
                            background: 'rgba(var(--text-primary-rgb), 0.03)', 
                            borderRadius: '16px', 
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-primary)' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(var(--text-primary-rgb), 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Share size={14} color="var(--accent)" />
                                </div>
                                <span>Appuie sur le bouton de <b>partage</b></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-primary)' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(var(--text-primary-rgb), 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <PlusSquare size={14} color="var(--accent)" />
                                </div>
                                <span>Puis sur <b>"Sur l'écran d'accueil"</b></span>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstall}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'linear-gradient(135deg, var(--accent), var(--success))',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '14px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                boxShadow: '0 8px 20px rgba(var(--accent-rgb), 0.2)'
                            }}
                        >
                            <Download size={18} />
                            Installer maintenant
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
