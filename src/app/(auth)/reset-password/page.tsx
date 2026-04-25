'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [ready, setReady] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const tryVerify = async () => {
            const searchParams = new URLSearchParams(window.location.search)
            const token_hash = searchParams.get('token_hash')
            const type = searchParams.get('type')

            if (token_hash && type === 'recovery') {
                const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
                if (error) setMessage('Lien invalide ou expiré. Redemandez un lien.')
                else setReady(true)
                return
            }

            const hash = window.location.hash
            if (hash) {
                const hashParams = new URLSearchParams(hash.substring(1))
                const access_token = hashParams.get('access_token')
                const refresh_token = hashParams.get('refresh_token')
                if (access_token) {
                    const { error } = await supabase.auth.setSession({ access_token, refresh_token: refresh_token || '' })
                    if (error) setMessage('Lien invalide ou expiré.')
                    else setReady(true)
                    return
                }
            }
            setMessage('Lien de réinitialisation invalide.')
        }
        tryVerify()
    }, [])

    const handleReset = async () => {
        if (!password) { setMessage('Entrez un nouveau mot de passe'); return }
        if (password !== confirm) { setMessage('Les mots de passe ne correspondent pas'); return }
        if (password.length < 6) { setMessage('Le mot de passe doit faire au moins 6 caractères'); return }

        setLoading(true)
        setMessage('')
        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setMessage(error.message)
            setLoading(false)
        } else {
            setMessage('Mot de passe mis à jour ! 🎉')
            setTimeout(() => router.push('/login'), 1500)
        }
    }

    const ACCENT_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
    const CARD_BG = 'rgba(10, 10, 10, 0.8)'

    if (!ready && !message) {
        return (
            <div style={{ minHeight: '100vh', background: '#040404', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16,185,129,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

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
            <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
                transition={{ duration: 10, repeat: Infinity }}
                style={{ position: 'fixed', top: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)' }} 
            />

            <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#10b981', marginBottom: '20px' }}>Cal Afrik</h2>
                    <div style={{ fontSize: '56px', marginBottom: '16px' }}>{message.includes('!') ? '✅' : '🔐'}</div>
                    <h1 style={{ fontSize: '30px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-1px' }}>
                        {ready ? 'Nouveau départ' : 'Lien expiré'}
                    </h1>
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
                    {!ready ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#f87171', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}><AlertCircle size={48} /></div>
                            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', fontSize: '15px' }}>{message}</p>
                            <motion.button
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                onClick={() => router.push('/forgot-password')}
                                style={{ width: '100%', height: '56px', background: ACCENT_GRADIENT, border: 'none', borderRadius: '18px', color: '#fff', fontWeight: '800', cursor: 'pointer' }}
                            >
                                Redemander un lien
                            </motion.button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><Lock size={18} /></div>
                                <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)}
                                    style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><ShieldCheck size={18} /></div>
                                <input type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)}
                                    style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>

                            {message && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '12px', borderRadius: '14px', background: message.includes('!') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: message.includes('!') ? '#10b981' : '#f87171', fontSize: '13px' }}>
                                    {message}
                                </motion.div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                onClick={handleReset} disabled={loading}
                                style={{
                                    width: '100%', height: '60px', background: loading ? 'rgba(255,255,255,0.05)' : ACCENT_GRADIENT,
                                    border: 'none', borderRadius: '20px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? 'Mise à jour...' : 'Changer le mot de passe'}
                            </motion.button>
                        </div>
                    )}
                </motion.div>
            </div>
            <style>{`input:focus { border-color: #10b981 !important; background: rgba(16,185,129,0.03) !important; }`}</style>
        </div>
    )
}
