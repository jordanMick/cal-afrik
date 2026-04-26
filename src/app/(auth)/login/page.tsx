'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff, ShieldCheck, ChevronRight, ChevronLeft } from 'lucide-react'
import { LeafIcon } from '@/components/icons/LeafIcon'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [isRegister, setIsRegister] = useState(false)
    const [regStep, setRegStep] = useState(1) // 1: Email, 2: Password

    const translateError = (err: string) => {
        if (err.includes('Invalid login credentials')) return "Email ou mot de passe incorrect 🧐"
        if (err.includes('User already registered')) return "Un compte existe déjà avec cet email ✉️"
        if (err.includes('at least 6 characters')) return "Le mot de passe doit faire au moins 6 caractères 🔑"
        if (err.includes('Email not confirmed')) return "Vérifie tes emails pour confirmer ton compte ! 📧"
        if (err.includes('rate limit')) return "Trop de tentatives ! Réessaie dans quelques minutes ⏳"
        return err
    }

    const DISPOSABLE_DOMAINS = [
        'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf',
        'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'p0p.tw.6x.to',
        'temp-mail.org', 'guerrillamail.com', 'sharklasers.com', 'mailinator.com',
        '10minutemail.com', 'trashmail.com', 'dispostable.com'
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError("L'adresse email n'est pas valide ❌")
            return
        }

        if (isRegister) {
            const domain = email.split('@')[1]?.toLowerCase()
            if (DISPOSABLE_DOMAINS.includes(domain)) {
                setError("Les emails jetables ne sont pas autorisés pour garantir la sécurité de ton compte 🛑")
                return
            }

            if (regStep === 1) {
                setRegStep(2)
                return
            }

            if (password !== confirmPassword) {
                setError("Les mots de passe ne correspondent pas ❌")
                return
            }
        }

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

    // New Premium Color Palette: Deep Emerald / Forest
    const ACCENT_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
    const CARD_BG = 'rgba(10, 10, 10, 0.8)'

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
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

            {/* Halos d'ambiance - Plus subtils et profonds */}
            <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
                transition={{ duration: 10, repeat: Infinity }}
                style={{ position: 'fixed', top: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)' }}
            />
            <motion.div
                animate={{ scale: [1.1, 1, 1.1], opacity: [0.15, 0.25, 0.15] }}
                transition={{ duration: 8, repeat: Infinity }}
                style={{ position: 'fixed', bottom: '-10%', left: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,95,70,0.1) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)' }}
            />

            <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center', position: 'relative', zIndex: 10 }}>

                {/* Header */}
                <motion.div
                    key={isRegister ? 'reg' : 'login'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '40px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                        <LeafIcon size={18} />
                        <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#10b981' }}>Cal Afrik</h2>
                    </div>
                    
                    {/* Illustration Scanner AI */}
                    <div style={{ 
                        position: 'relative', 
                        width: '100px', 
                        height: '100px', 
                        margin: '0 auto 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {/* Scanner Corners */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '3px solid #10b981', borderLeft: '3px solid #10b981', borderRadius: '4px 0 0 0' }} />
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '3px solid #10b981', borderRight: '3px solid #10b981', borderRadius: '0 4px 0 0' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '3px solid #10b981', borderLeft: '3px solid #10b981', borderRadius: '0 0 0 4px' }} />
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981', borderRadius: '0 0 4px 0' }} />
                        
                        <div style={{ fontSize: '50px' }}>
                            {isRegister ? '🥗' : '🍲'}
                        </div>
                        
                        {/* Scanning Line Animation */}
                        <motion.div 
                            animate={{ top: ['10%', '90%', '10%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            style={{ position: 'absolute', left: '10%', right: '10%', height: '2px', background: 'rgba(16,185,129,0.5)', boxShadow: '0 0 10px #10b981', zIndex: 2 }}
                        />
                    </div>

                    <h1 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '12px', letterSpacing: '-1px', lineHeight: '1.1' }}>
                        {isRegister 
                            ? (regStep === 1 ? 'Commence ton suivi nutrition intelligent' : 'Sécurise ton compte') 
                            : 'Reprends le contrôle de ton alimentation'}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', fontWeight: '500', lineHeight: '1.5' }}>
                        {isRegister
                            ? (regStep === 1 ? 'Analyse tes repas en quelques secondes' : 'Choisis un mot de passe robuste')
                            : 'Scanne tes plats et optimise ton alimentation'}
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
                            key={isRegister ? `reg-${regStep}` : 'login'}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Google Login (Only on Step 1 or Login) */}
                            {(!isRegister || regStep === 1) && (
                                <>
                                    <div style={{ marginBottom: '24px' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleGoogleLogin}
                                            style={{
                                                width: '100%', height: '56px', background: '#fff', border: 'none', borderRadius: '18px',
                                                color: '#000', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer'
                                            }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                            </svg>
                                            {isRegister ? "S'inscrire avec Google" : "Continuer avec Google"}
                                        </motion.button>
                                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontWeight: '500' }}>🛡️ Rapide et sécurisé</p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Ou</span>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                    </div>
                                </>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                                {(!isRegister || regStep === 1) && (
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}>
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="email" value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Email" required
                                            style={{
                                                width: '100%', height: '56px', padding: '0 18px 0 50px',
                                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                )}

                                {(!isRegister || regStep === 2) && (
                                    <>
                                        {isRegister && (
                                            <button
                                                type="button"
                                                onClick={() => setRegStep(1)}
                                                style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '4px' }}
                                            >
                                                <ChevronLeft size={14} /> Modifier l'email
                                            </button>
                                        )}
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}>
                                                <Lock size={18} />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"} value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={isRegister ? "Mot de passe" : "Ton mot de passe"} required
                                                style={{
                                                    width: '100%', height: '56px', padding: '0 50px 0 50px',
                                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
                                                }}
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>

                                        {isRegister && (
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}>
                                                    <ShieldCheck size={18} />
                                                </div>
                                                <input
                                                    type={showPassword ? "text" : "password"} value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Confirmer le mot de passe" required
                                                    style={{
                                                        width: '100%', height: '56px', padding: '0 18px 0 50px',
                                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {!isRegister && (
                                    <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                                        <button type="button" onClick={() => router.push('/forgot-password')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                                            Mot de passe oublié ?
                                        </button>
                                    </div>
                                )}

                                {error && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '14px', color: '#f87171', fontSize: '13px', border: '1px solid rgba(239,68,68,0.1)' }}>
                                        {error}
                                    </motion.div>
                                )}

                                {successMsg && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '14px', color: '#10b981', fontSize: '13px', border: '1px solid rgba(16,185,129,0.1)' }}>
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
                                        boxShadow: isLoading ? 'none' : '0 8px 20px rgba(16,185,129,0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                    }}
                                >
                                    {isLoading ? (
                                        <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <>
                                            {isRegister ? (regStep === 1 ? 'Suivant' : 'Commencer maintenant') : 'Accéder à mon suivi'}
                                            {(isRegister && regStep === 1) ? <ChevronRight size={18} /> : (isRegister ? <UserPlus size={20} /> : <LogIn size={20} />)}
                                        </>
                                    )}
                                </motion.button>

                                {/* Preuve Sociale / Trust Badges */}
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    gap: '12px', 
                                    marginTop: '20px',
                                    flexWrap: 'wrap'
                                }}>
                                    {[
                                        { icon: '✔', text: '+10 000 utilisateurs' },
                                        { icon: '✔', text: 'Résultats en 7 jours' },
                                        { icon: '✔', text: 'Basé sur l’IA' }
                                    ].map((badge, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ color: '#10b981', fontSize: '10px', fontWeight: '900' }}>{badge.icon}</span>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: '600' }}>{badge.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* Toggle Login/Register */}
                <motion.div style={{ marginTop: '32px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
                        {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}
                        <button
                            onClick={() => { setIsRegister(!isRegister); setRegStep(1); setError(''); setSuccessMsg('') }}
                            style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: '800', marginLeft: '8px', cursor: 'pointer' }}
                        >
                            {isRegister ? 'Se connecter' : "S'inscrire"}
                        </button>
                    </p>
                </motion.div>

                <div style={{ marginTop: '40px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', lineHeight: '1.6' }}>
                    En continuant, tu acceptes nos{' '}
                    <span onClick={() => router.push('/terms')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>CGU</span>
                    {' '}et notre{' '}
                    <span onClick={() => router.push('/privacy')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Confidentialité</span>
                </div>
            </div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input:focus { border-color: #10b981 !important; background: rgba(16,185,129,0.03) !important; }
            `}</style>
        </div>
    )
}
