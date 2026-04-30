'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff, ShieldCheck, ChevronRight, ChevronLeft, KeyRound } from 'lucide-react'
import { LeafIcon } from '@/components/icons/LeafIcon'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [confirmEmail, setConfirmEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [isRegister, setIsRegister] = useState(false)
    const [regStep, setRegStep] = useState(1) 
    const [isOtpMode, setIsOtpMode] = useState(false) 
    const [otp, setOtp] = useState('')

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('mode') === 'register') {
            setIsRegister(true)
        }
    }, [])

    const translateError = (err: string) => {
        if (err.includes('Invalid login credentials')) return "Email ou mot de passe incorrect 🧐"
        if (err.includes('User already registered')) return "Un compte existe déjà avec cet email ✉️"
        if (err.includes('at least 6 characters')) return "Le mot de passe doit faire au moins 6 caractères 🔑"
        if (err.includes('Email not confirmed')) return "Vérifie tes emails pour confirmer ton compte ! 📧"
        if (err.includes('rate limit')) return "Trop de tentatives ! Réessaie dans quelques minutes ⏳"
        if (err.includes('Token has expired')) return "Le code a expiré ou est invalide ❌"
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
        setError('')
        setSuccessMsg('')

        if (isOtpMode) {
            if (otp.length < 6) { setError("Saisis les 6 chiffres du code 🔢"); return }
            setIsLoading(true)
            try {
                const { error } = await supabase.auth.verifyOtp({
                    email,
                    token: otp,
                    type: 'recovery'
                })
                if (error) { setError(translateError(error.message)); return }
                router.push('/reset-password')
            } catch {
                setError("Erreur lors de la vérification")
            } finally {
                setIsLoading(false)
            }
            return
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError("L'adresse email n'est pas valide ❌")
            return
        }

        if (isRegister) {
            if (regStep === 1) {
                if (email !== confirmEmail) {
                    setError("Les adresses e-mail ne correspondent pas ❌")
                    return
                }

                const domain = email.split('@')[1]?.toLowerCase()
                if (DISPOSABLE_DOMAINS.includes(domain)) {
                    setError("Les emails jetables ne sont pas autorisés 🛑")
                    return
                }

                setIsLoading(true)
                try {
                    const res = await fetch('/api/auth/verify-domain', {
                        method: 'POST',
                        body: JSON.stringify({ email })
                    })
                    const data = await res.json()
                    if (!data.success) {
                        setError(data.error || "Domaine invalide")
                        return
                    }
                    setRegStep(2)
                } catch (err) {
                    setError("Erreur lors de la vérification du domaine")
                } finally {
                    setIsLoading(false)
                }
                return
            }

            if (password !== confirmPassword) {
                setError("Les mots de passe ne correspondent pas ❌")
                return
            }
            if (password.length < 6) {
                setError("Le mot de passe doit faire au moins 6 caractères 🔑")
                return
            }
        }

        setIsLoading(true)
        try {
            if (isRegister) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { email_confirmed: true } }
                })
                if (error) { setError(translateError(error.message)); return }
                
                try {
                    await fetch('/api/auth/verify-domain', {
                        method: 'POST',
                        body: JSON.stringify({ email, logSignup: true })
                    })
                } catch (logErr) {
                    console.error('Erreur logging signup IP:', logErr)
                }

                if (data.session) {
                    router.push('/onboarding')
                } else {
                    setSuccessMsg('Compte créé ! Vérifie tes mails 📧')
                }
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

    const handleSendRecoveryOtp = async () => {
        if (!email) { setError("Saisis ton email d'abord ! 📧"); return }
        setIsLoading(true)
        setError('')
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email)
            if (error) { setError(translateError(error.message)); return }
            setIsOtpMode(true)
            setSuccessMsg("Code à 6 chiffres envoyé par mail ! 📧")
        } catch {
            setError("Erreur lors de l'envoi du code")
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
        } catch {
            setError('Erreur Google Login')
        }
    }

    // Design System constants
    const COLORS = {
        primary: '#10b981',
        primaryDark: '#065f46',
        bg: '#020617',
        card: 'rgba(15, 23, 42, 0.7)',
        textMuted: 'rgba(255, 255, 255, 0.5)'
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: COLORS.bg, 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '24px', 
            fontFamily: 'var(--font-dm-sans), sans-serif', 
            position: 'relative', 
            overflow: 'hidden' 
        }}>
            
            {/* Background Halos - Deep Emerald Theme */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1], 
                    opacity: [0.15, 0.25, 0.15],
                    rotate: [0, 90, 0]
                }} 
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }} 
                style={{ position: 'absolute', top: '-20%', right: '-10%', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: 0 }} 
            />
            <motion.div 
                animate={{ 
                    scale: [1.2, 1, 1.2], 
                    opacity: [0.1, 0.2, 0.1],
                    rotate: [0, -90, 0]
                }} 
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }} 
                style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,95,70,0.2) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: 0 }} 
            />

            <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 10 }}>
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none', marginBottom: '16px' }}>
                        <div style={{ background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <LeafIcon size={28} />
                        </div>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', color: COLORS.primary, margin: 0, fontFamily: 'var(--font-syne), sans-serif' }}>Cal Afrik</h1>
                    </Link>
                </div>

                <motion.div 
                    layout 
                    style={{ 
                        background: COLORS.card, 
                        backdropFilter: 'blur(30px)', 
                        borderRadius: '40px', 
                        padding: '48px 40px', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Subtle border shine effect */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)' }} />

                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={isOtpMode ? 'otp' : (isRegister ? `reg-${regStep}` : 'login')} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }} 
                            transition={{ duration: 0.3 }}
                        >
                            
                            <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '12px', fontFamily: 'var(--font-syne), sans-serif', letterSpacing: '-0.5px' }}>
                                {isOtpMode ? "Code de vérification" : (isRegister ? "Nouveau compte" : "Bon retour parmi nous")}
                            </h2>
                            <p style={{ fontSize: '15px', color: COLORS.textMuted, marginBottom: '40px', lineHeight: 1.5 }}>
                                {isOtpMode ? `Nous avons envoyé un code à 6 chiffres à ${email}` : (isRegister ? "Commencez votre voyage vers une meilleure santé." : "Entrez vos identifiants pour accéder à votre dashboard.")}
                            </p>

                            {/* Social Auth */}
                            {!isOtpMode && (!isRegister || regStep === 1) && (
                                <>
                                    <motion.button 
                                        whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }} 
                                        whileTap={{ scale: 0.98 }} 
                                        onClick={handleGoogleLogin} 
                                        style={{ 
                                            width: '100%', height: '60px', background: '#fff', border: 'none', borderRadius: '20px', 
                                            color: '#000', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', 
                                            justifyContent: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px', transition: 'background-color 0.2s' 
                                        }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                        Continuer avec Google
                                    </motion.button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '32px 0' }}>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>OU</span>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                    </div>
                                </>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {isOtpMode ? (
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: COLORS.primary }}><KeyRound size={22} /></div>
                                        <input 
                                            type="text" maxLength={6} value={otp} 
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                                            placeholder="000000" required 
                                            style={{ 
                                                width: '100%', height: '64px', padding: '0 20px 0 54px', 
                                                background: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.primary}40`, 
                                                borderRadius: '20px', color: '#fff', fontSize: '24px', letterSpacing: '10px', 
                                                textAlign: 'center', outline: 'none', fontWeight: '900' 
                                            }} 
                                        />
                                    </div>
                                ) : (
                                    <>
                                        {(!isRegister || regStep === 1) && (
                                            <>
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }}><Mail size={20} /></div>
                                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse e-mail" required style={{ width: '100%', height: '60px', padding: '0 20px 0 54px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff', fontSize: '16px', outline: 'none' }} />
                                                </div>
                                                {isRegister && (
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }}><Mail size={20} /></div>
                                                        <input type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="Confirmer l'e-mail" required style={{ width: '100%', height: '60px', padding: '0 20px 0 54px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff', fontSize: '16px', outline: 'none' }} />
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {(!isRegister || regStep === 2) && (
                                            <>
                                                {isRegister && <button type="button" onClick={() => setRegStep(1)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: COLORS.primary, fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '8px' }}><ChevronLeft size={16} /> Retour à l'e-mail</button>}
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }}><Lock size={20} /></div>
                                                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? "Mot de passe" : "Mot de passe"} required style={{ width: '100%', height: '60px', padding: '0 54px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff', fontSize: '16px', outline: 'none' }} />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                                                </div>
                                                {isRegister && (
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }}><ShieldCheck size={20} /></div>
                                                        <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer mot de passe" required style={{ width: '100%', height: '60px', padding: '0 20px 0 54px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff', fontSize: '16px', outline: 'none' }} />
                                                    </div>
                                                )}
                                                {!isRegister && (
                                                    <button type="button" onClick={handleSendRecoveryOtp} style={{ alignSelf: 'flex-end', fontSize: '14px', fontWeight: '700', color: COLORS.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '-4px' }}>Mot de passe oublié ?</button>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {error && <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', borderRadius: '16px', color: '#fca5a5', fontSize: '14px', border: '1px solid rgba(239,68,68,0.2)', fontWeight: '600' }}>{error}</motion.div>}
                                {successMsg && <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', color: '#6ee7b7', fontSize: '14px', border: '1px solid rgba(16,185,129,0.2)', fontWeight: '600' }}>{successMsg}</motion.div>}

                                <motion.button 
                                    whileHover={{ scale: 1.01, boxShadow: '0 15px 35px rgba(16,185,129,0.4)' }} 
                                    whileTap={{ scale: 0.99 }} 
                                    type="submit" disabled={isLoading} 
                                    style={{ 
                                        width: '100%', height: '64px', 
                                        background: `linear-gradient(135deg, ${COLORS.primaryDark} 0%, ${COLORS.primary} 100%)`, 
                                        border: 'none', borderRadius: '20px', color: '#fff', fontSize: '17px', 
                                        fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                                        justifyContent: 'center', gap: '10px', marginTop: '12px', 
                                        boxShadow: '0 10px 25px rgba(16,185,129,0.25)', transition: 'all 0.3s' 
                                    }}
                                >
                                    {isLoading ? "Vérification..." : (isOtpMode ? "Vérifier le code" : (isRegister ? (regStep === 1 ? "Suivant" : "S'inscrire") : "Se connecter"))}
                                    {!isLoading && <ChevronRight size={20} />}
                                </motion.button>
                            </form>

                            <div style={{ marginTop: '40px' }}>
                                <button onClick={() => { setIsRegister(!isRegister); setRegStep(1); setIsOtpMode(false); setError(''); setSuccessMsg('') }} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '15px', cursor: 'pointer', fontWeight: '500' }}>
                                    {isRegister ? "Déjà un compte ? " : "Pas encore de compte ? "}
                                    <span style={{ color: COLORS.primary, fontWeight: '800' }}>{isRegister ? "Se connecter" : "S'inscrire"}</span>
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                <p style={{ marginTop: '40px', fontSize: '13px', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '800' }}>
                    © 2026 CAL AFRIK — IA NUTRITIONNELLE
                </p>
            </div>
        </div>
    )
}
