'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Mail, Send } from 'lucide-react'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSendReset = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return
        setLoading(true)
        setMessage('')

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })

        if (error) {
            setMessage(error.message)
            setLoading(false)
        } else {
            setMessage('Lien envoyé ! Vérifie ta boîte mail 📧')
            setLoading(false)
        }
    }

    const ACCENT_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
    const CARD_BG = 'rgba(10, 10, 10, 0.8)'

    return (
        <div style={{
            minHeight: '100vh',
            background: '#040404',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: 'Inter, system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden',
            color: '#fff'
        }}>
            {/* Halos d'ambiance */}
            <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
                transition={{ duration: 10, repeat: Infinity }}
                style={{ position: 'fixed', top: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)' }} 
            />

            <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '40px' }}
                >
                    <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#10b981', marginBottom: '20px' }}>Cal-Afrik</h2>
                    <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔑</div>
                    <h1 style={{ fontSize: '30px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-1px' }}>Oubli ?</h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', fontWeight: '500' }}>On va te renvoyer un accès sécurisé</p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ 
                        background: CARD_BG, 
                        backdropFilter: 'blur(25px)',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                    }}
                >
                    <button 
                        onClick={() => router.push('/login')} 
                        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '24px', padding: 0 }}
                    >
                        <ChevronLeft size={16} /> Retour à la connexion
                    </button>

                    <form onSubmit={handleSendReset} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative', textAlign: 'left' }}>
                            <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}>
                                <Mail size={18} />
                            </div>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="Email du compte" required
                                style={{
                                    width: '100%', height: '56px', padding: '0 18px 0 50px',
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {message && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }}
                                style={{ 
                                    padding: '12px', borderRadius: '14px',
                                    background: message.includes('Email') || message.includes('Lien') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                    border: `1px solid ${message.includes('Email') || message.includes('Lien') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}`,
                                    color: message.includes('Email') || message.includes('Lien') ? '#10b981' : '#f87171',
                                    fontSize: '13px', fontWeight: '500'
                                }}
                            >
                                {message}
                            </motion.div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit" disabled={loading}
                            style={{
                                width: '100%', height: '60px',
                                background: loading ? 'rgba(255,255,255,0.05)' : ACCENT_GRADIENT,
                                border: 'none', borderRadius: '20px',
                                color: '#fff', fontSize: '16px', fontWeight: '800',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                boxShadow: loading ? 'none' : '0 12px 24px rgba(16,185,129,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                            }}
                        >
                            {loading ? (
                                <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <>
                                    <span>Envoyer le lien</span>
                                    <Send size={18} />
                                </>
                            )}
                        </motion.button>
                    </form>
                </motion.div>
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input:focus { border-color: #10b981 !important; background: rgba(16,185,129,0.03) !important; }
            `}</style>
        </div>
    )
}
