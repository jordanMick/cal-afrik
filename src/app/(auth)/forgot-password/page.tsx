'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Mail, Send, Lock, ShieldCheck, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const router = useRouter()
    const otpRefs = useRef<(HTMLInputElement | null)[]>(new Array(6).fill(null))

    // Step 1: Send OTP
    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email)
            if (error) throw error
            setStep(2)
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'envoi du code')
        } finally {
            setLoading(false)
        }
    }

    // OTP Input logic
    const handleOtpChange = (value: string, index: number) => {
        if (!/^\d*$/.test(value)) return
        const newOtp = [...otp]
        newOtp[index] = value.slice(-1)
        setOtp(newOtp)
        if (value && index < 5) otpRefs.current[index + 1]?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    // Step 2: Verify OTP
    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        const token = otp.join('')
        if (token.length < 6) return
        setLoading(true)
        setError('')
        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'recovery'
            })
            if (error) throw error
            setStep(3)
        } catch (err: any) {
            setError('Code invalide ou expiré ❌')
        } finally {
            setLoading(false)
        }
    }

    // Step 3: Update Password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas ❌')
            return
        }
        setLoading(true)
        setError('')
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setSuccessMsg('Mot de passe mis à jour ! 🎉')
            setTimeout(() => router.push('/login'), 2000)
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la mise à jour')
        } finally {
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
                
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#10b981', marginBottom: '20px' }}>Cal Afrik</h2>
                    <div style={{ fontSize: '56px', marginBottom: '16px' }}>
                        {step === 1 ? '🔑' : step === 2 ? '📧' : '🛡️'}
                    </div>
                    <h1 style={{ fontSize: '30px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-1px' }}>
                        {step === 1 ? 'Oubli ?' : step === 2 ? 'Vérification' : 'Nouveau code'}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', fontWeight: '500' }}>
                        {step === 1 ? 'On va te renvoyer un accès sécurisé' : step === 2 ? `Saisis le code envoyé à ${email}` : 'Choisis un mot de passe robuste'}
                    </p>
                </motion.div>

                <motion.div 
                    layout
                    style={{ 
                        background: CARD_BG, 
                        backdropFilter: 'blur(25px)',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                    }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <button 
                                onClick={() => step === 1 ? router.push('/login') : setStep(step - 1)} 
                                style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '24px', padding: 0 }}
                            >
                                <ChevronLeft size={16} /> {step === 1 ? 'Retour à la connexion' : 'Retour'}
                            </button>

                            {step === 1 && (
                                <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ position: 'relative', textAlign: 'left' }}>
                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><Mail size={18} /></div>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email du compte" required
                                            style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <ActionButton loading={loading} text="Recevoir le code" icon={<Send size={18} />} />
                                </form>
                            )}

                            {step === 2 && (
                                <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        {otp.map((digit, i) => (
                                            <input
                                                key={i}
                                                ref={(el) => {
                                                    otpRefs.current[i] = el;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                value={digit}
                                                onChange={e => handleOtpChange(e.target.value, i)}
                                                onKeyDown={e => handleKeyDown(e, i)}
                                                style={{
                                                    width: '45px', height: '56px', textAlign: 'center', fontSize: '20px', fontWeight: '800',
                                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '14px', color: '#10b981', outline: 'none'
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <ActionButton loading={loading} text="Vérifier le code" icon={<ShieldCheck size={18} />} />
                                    <button type="button" onClick={handleSendOTP} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                                        Renvoyer un code
                                    </button>
                                </form>
                            )}

                            {step === 3 && (
                                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><Lock size={18} /></div>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nouveau mot de passe" required
                                            style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><ShieldCheck size={18} /></div>
                                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmer le mot de passe" required
                                            style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <ActionButton loading={loading} text="Changer le mot de passe" icon={<CheckCircle size={18} />} />
                                </form>
                            )}

                            {error && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '20px', padding: '12px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.1)', color: '#f87171', fontSize: '13px', fontWeight: '500' }}>
                                    {error}
                                </motion.div>
                            )}

                            {successMsg && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '20px', padding: '12px', borderRadius: '14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.1)', color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                                    {successMsg}
                                </motion.div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input:focus { border-color: #10b981 !important; background: rgba(16,185,129,0.03) !important; }
            `}</style>
        </div>
    )
}

function ActionButton({ loading, text, icon }: { loading: boolean, text: string, icon: React.ReactNode }) {
    const ACCENT_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
    return (
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
                    <span>{text}</span>
                    {icon}
                </>
            )}
        </motion.button>
    )
}
