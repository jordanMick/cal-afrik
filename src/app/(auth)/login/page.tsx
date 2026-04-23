'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff, Github, Chrome, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [isRegister, setIsRegister] = useState(false)

    const translateError = (err: string) => {
        if (err.includes('Invalid login credentials')) return "Email ou mot de passe incorrect 🧐"
        if (err.includes('User already registered')) return "Un compte existe déjà avec cet email ✉️"
        if (err.includes('at least 6 characters')) return "Le mot de passe doit faire au moins 6 caractères 🔑"
        if (err.includes('Email not confirmed')) return "Vérifie tes emails pour confirmer ton compte ! 📧"
        if (err.includes('rate limit')) return "Trop de tentatives ! Réessaie dans quelques minutes ⏳"
        return err
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        setSuccessMsg('')
        try {
            if (isRegister) {
                const siteUrl = window.location.origin
                const { data, error } = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: { emailRedirectTo: `${siteUrl}/onboarding` }
                })
                if (error) { setError(translateError(error.message)); return }
                if (!data.session) {
                    setSuccessMsg('Compte créé ! Vérifie ta boîte mail pour valider ton inscription 📧')
                    return
                }
                router.push('/onboarding')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) { setError(translateError(error.message)); return }
                router.push('/dashboard')
            }
        } catch {
            setError('Une erreur est survenue lors de la connexion')
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`
                }
            })
            if (error) setError(translateError(error.message))
        } catch (e) {
            setError('Erreur lors de la connexion avec Google')
        }
    }

    const ACCENT_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #10b981 100%)'
    const CARD_BG = 'rgba(15, 15, 15, 0.7)'

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

            {/* Halos d'ambiance Animés */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                    x: [0, 50, 0],
                    y: [0, -50, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                style={{ position: 'fixed', top: '-10%', right: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(60px)' }} 
            />
            <motion.div 
                animate={{ 
                    scale: [1.2, 1, 1.2],
                    opacity: [0.2, 0.4, 0.2],
                    x: [0, -30, 0],
                    y: [0, 40, 0]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                style={{ position: 'fixed', bottom: '-10%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(60px)' }} 
            />

            <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                
                {/* Logo / Badge Social Proof */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '40px' }}
                >
                    <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 14px', 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '100px', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '24px'
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                            Rejoins +5 000 Cal-Afrikains 🌍
                        </span>
                    </div>

                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                        {isRegister ? '🌱' : '⚡'}
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-1px' }}>
                        {isRegister ? 'Prêt pour le changement ?' : 'Bon retour !'}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', fontWeight: '500' }}>
                        {isRegister ? 'Ton voyage nutritionnel commence ici' : 'Prépare ton prochain repas local'}
                    </p>
                </motion.div>

                {/* Main Card Area */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ 
                        background: CARD_BG, 
                        backdropFilter: 'blur(20px)',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* Google Login Premium Button */}
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGoogleLogin}
                            style={{
                                width: '100%',
                                height: '56px',
                                background: '#fff',
                                border: 'none',
                                borderRadius: '18px',
                                color: '#000',
                                fontSize: '15px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            {isRegister ? "S'inscrire avec Google" : "Se connecter avec Google"}
                        </motion.button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Ou</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email" value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email" required
                                    style={{
                                        width: '100%', height: '56px', padding: '0 18px 0 50px',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '18px', color: '#fff', fontSize: '15px',
                                        outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"} value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mot de passe" required
                                    style={{
                                        width: '100%', height: '56px', padding: '0 50px 0 50px',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '18px', color: '#fff', fontSize: '15px',
                                        outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box'
                                    }}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {!isRegister && (
                                <div style={{ textAlign: 'right', marginTop: '-10px' }}>
                                    <button 
                                        type="button"
                                        onClick={() => router.push('/forgot-password')}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                                    >
                                        Mot de passe oublié ?
                                    </button>
                                </div>
                            )}

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '14px', color: '#f87171', fontSize: '13px', border: '1px solid rgba(239,68,68,0.2)', fontWeight: '500' }}
                                >
                                    {error}
                                </motion.div>
                            )}

                            {successMsg && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '14px', color: '#10b981', fontSize: '13px', border: '1px solid rgba(16,185,129,0.2)', fontWeight: '500' }}
                                >
                                    {successMsg}
                                </motion.div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="submit" disabled={isLoading}
                                style={{
                                    width: '100%', height: '60px',
                                    background: isLoading ? 'rgba(255,255,255,0.05)' : ACCENT_GRADIENT,
                                    border: 'none', borderRadius: '20px',
                                    color: '#fff', fontSize: '16px', fontWeight: '800',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    marginTop: '8px',
                                    boxShadow: isLoading ? 'none' : '0 10px 25px rgba(99,102,241,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {isLoading ? (
                                    <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <>
                                        {isRegister ? <UserPlus size={20} /> : <LogIn size={20} />}
                                        <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            {isRegister ? 'Ouvrir mon compte' : 'Se connecter'}
                                        </span>
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </motion.div>

                {/* Footer Toggle */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ marginTop: '32px' }}
                >
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
                        {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}
                        <button 
                            onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg('') }}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#fff', 
                                fontWeight: '800', 
                                marginLeft: '8px', 
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            {isRegister ? 'Se connecter' : "S'inscrire"}
                        </button>
                    </p>
                </motion.div>

                <div style={{ marginTop: '40px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: '1.6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} />
                    <span>
                        En continuant, tu acceptes nos{' '}
                        <span onClick={() => router.push('/terms')} style={{ textDecoration: 'underline', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>CGU</span>
                        {' '}et notre{' '}
                        <span onClick={() => router.push('/privacy')} style={{ textDecoration: 'underline', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>Confidentialité</span>
                    </span>
                </div>
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input:focus { border-color: #6366f1 !important; background: rgba(255,255,255,0.06) !important; }
            `}</style>
        </div>
    )
}
                </div>
            </div>
        </div>
    )
}