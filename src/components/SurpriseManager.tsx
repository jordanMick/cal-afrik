'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { Gift, X, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export default function SurpriseManager() {
    const { profile, surpriseStatus, setSurpriseStatus } = useAppStore()
    const [copied, setCopied] = useState(false)

    // Si déjà supprimé ou pas de code, on n'affiche rien
    if (surpriseStatus === 'claimed' || !profile?.promo_code) return null

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(profile.promo_code || '')
        setCopied(true)
        toast.success('Code copié !')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSurpriseStatus('claimed')
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                    background: 'linear-gradient(135deg, #6366f1, #10b981)',
                    padding: '16px 20px',
                    borderRadius: '24px',
                    marginBottom: '24px',
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
                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>Cadeau de bienvenue ! 🎁</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: '500' }}>Code : </p>
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900', letterSpacing: '1px', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '6px' }}>{profile.promo_code}</span>
                            <button 
                                onClick={handleCopy}
                                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleDismiss}
                    style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                >
                    <X size={16} />
                </button>
            </motion.div>
        </AnimatePresence>
    )
}
