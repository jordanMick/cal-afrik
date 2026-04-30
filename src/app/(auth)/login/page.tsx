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
    const [regStep, setRegStep] = useState(1) // 1: Email, 2: Password
    const [isOtpMode, setIsOtpMode] = useState(false) // Pour la récupération par code
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

        // Mode OTP (Récupération)
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
                // Succès : rediriger vers le changement de mot de passe
                router.push('/settings/security?mode=reset')
            } catch {
                setError("Erreur lors de la vérification")
            } finally {
                setIsLoading(false)
            }
            return
        }

        // Validation Email (Format)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError("L'adresse email n'est pas valide ❌")
            return
        }

        if (isRegister) {
            // ÉTAPE 1 : Validation E-mail et Domaine
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

            // ÉTAPE 2 : Validation Mot de passe
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

    // Styles & Constantes
    const ACCENT_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
    const CARD_BG = 'rgba(15, 23, 42, 0.6)'

    return (
        <div style={{ minHeight: '100vh', background: '#020617', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-dm-sans), sans-serif', position: 'relative', overflow: 'hidden' }}>
            
            {/* Halos d'ambiance */}
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 8, repeat: Infinity }} style={{ position: 'absolute', top: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
            <motion.div animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity }} style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,95,70,0.15) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />

            <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10, textAlign: 'center' }}>
                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '40px', textDecoration: 'none' }}>
                    <LeafIcon size={24} />
                    <h1 style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', color: '#10b981', margin: 0 }}>Cal Afrik</h1>
                </Link>

                <motion.div layout style={{ background: CARD_BG, backdropFilter: 'blur(25px)', borderRadius: '32px', padding: '32px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                    <AnimatePresence mode="wait">
                        <motion.div key={isOtpMode ? 'otp' : (isRegister ? `reg-${regStep}` : 'login')} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                            
                            <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', fontFamily: 'var(--font-syne), sans-serif' }}>
                                {isOtpMode ? "Code de vérification" : (isRegister ? "Nouveau compte" : "Bon retour parmi nous")}
                            </h2>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>
                                {isOtpMode ? `Saisis le code envoyé à ${email}` : (isRegister ? "Commence ton voyage santé" : "Connecte-toi pour suivre tes progrès")}
                            </p>

                            {/* Google Login (Seulement Login/Register Step 1) */}
                            {!isOtpMode && (!isRegister || regStep === 1) && (
                                <>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGoogleLogin} style={{ width: '100%', height: '56px', background: '#fff', border: 'none', borderRadius: '18px', color: '#000', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                        Google
                                    </motion.button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '700', textTransform: 'uppercase' }}>Ou</span>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                                    </div>
                                </>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                
                                {isOtpMode ? (
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(16,185,129,0.5)' }}><KeyRound size={20} /></div>
                                        <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="Code à 6 chiffres" required style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '18px', color: '#fff', fontSize: '20px', letterSpacing: '8px', textAlign: 'center', outline: 'none' }} />
                                    </div>
                                ) : (
                                    <>
                                        {(!isRegister || regStep === 1) && (
                                            <>
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><Mail size={18} /></div>
                                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none' }} />
                                                </div>
                                                {isRegister && (
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><Mail size={18} /></div>
                                                        <input type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="Confirmer l'email" required style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none' }} />
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {(!isRegister || regStep === 2) && (
                                            <>
                                                {isRegister && <button type="button" onClick={() => setRegStep(1)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><ChevronLeft size={14} /> Retour</button>}
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><Lock size={18} /></div>
                                                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? "Mot de passe" : "Ton mot de passe"} required style={{ width: '100%', height: '56px', padding: '0 50px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none' }} />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                                </div>
                                                {isRegister && (
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}><ShieldCheck size={18} /></div>
                                                        <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer mot de passe" required style={{ width: '100%', height: '56px', padding: '0 18px 0 50px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: '#fff', fontSize: '15px', outline: 'none' }} />
                                                    </div>
                                                )}
                                                {!isRegister && (
                                                    <button type="button" onClick={handleSendRecoveryOtp} style={{ alignSelf: 'flex-end', fontSize: '13px', fontWeight: '600', color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '-8px' }}>Mot de passe oublié ?</button>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '14px', color: '#f87171', fontSize: '13px', border: '1px solid rgba(239,68,68,0.1)' }}>{error}</motion.div>}
                                {successMsg && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '14px', color: '#10b981', fontSize: '13px', border: '1px solid rgba(16,185,129,0.1)' }}>{successMsg}</motion.div>}

                                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="submit" disabled={isLoading} style={{ width: '100%', height: '56px', background: ACCENT_GRADIENT, border: 'none', borderRadius: '18px', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', boxShadow: '0 10px 30px rgba(16,185,129,0.2)' }}>
                                    {isLoading ? "Action en cours..." : (isOtpMode ? "Vérifier le code" : (isRegister ? (regStep === 1 ? "Continuer" : "S'inscrire") : "Se connecter"))}
                                    {!isLoading && <ChevronRight size={18} />}
                                </motion.button>
                            </form>

                            <div style={{ marginTop: '32px' }}>
                                <button onClick={() => { setIsRegister(!isRegister); setRegStep(1); setIsOtpMode(false); setError(''); setSuccessMsg('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer' }}>
                                    {isRegister ? "Déjà un compte ? " : "Pas encore de compte ? "}
                                    <span style={{ color: '#10b981', fontWeight: '700' }}>{isRegister ? "Se connecter" : "S'inscrire"}</span>
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                <p style={{ marginTop: '32px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '2px' }}>© 2026 Cal Afrik — Santé Digitale</p>
            </div>
        </div>
    )
}
