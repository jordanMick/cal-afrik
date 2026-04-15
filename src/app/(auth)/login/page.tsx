import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [isRegister, setIsRegister] = useState(false)

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
                if (error) { setError(error.message); return }
                if (!data.session) {
                    setSuccessMsg('Compte créé ! Veuillez vérifier votre boîte de réception.')
                    return
                }
                router.push('/onboarding')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) { setError(error.message); return }
                router.push('/dashboard')
            }
        } catch {
            setError('Une erreur est survenue')
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
            if (error) setError(error.message)
        } catch (e) {
            setError('Erreur lors de la connexion avec Google')
        }
    }

    const ACCENT_GRADIENT = 'linear-gradient(135deg, #6366f1, #10b981)'
    const INPUT_BG = '#111'
    const CARD_BG = '#0a0a0a'

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
            <div style={{ position: 'fixed', top: '-10%', right: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-10%', left: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                
                {/* Header Section */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ fontSize: '42px', marginBottom: '16px', display: 'block' }}>
                        {isRegister ? '🔥' : '👋'}
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                        {isRegister ? 'Crée ton compte gratuit' : 'Bon retour !'}
                    </h1>
                    <p style={{ color: '#888', fontSize: '15px' }}>
                        {isRegister ? '2 analyses offertes à l’inscription' : 'Connecte-toi pour continuer'}
                    </p>
                </div>

                {/* Main Action Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Google Login */}
                    <button 
                        onClick={handleGoogleLogin}
                        style={{
                            width: '100%',
                            height: '52px',
                            background: CARD_BG,
                            border: '1px solid #222',
                            borderRadius: '14px',
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12.48 10.92v3.28h7.84c-.24 1.84-.9 3.47-2.13 4.68l-2.73-2.73c.7-.48 1.25-1.15 1.58-1.95h-4.56z"/>
                            <path fill="#FBBC05" d="M7.7 14.64L5 17.34c-1.39-1.38-2.2-3.3-2.2-5.34 0-2.04.81-3.96 2.2-5.34l2.7 2.7c-.5.5-.8 1.1-.8 1.8 0 .7.3 1.3.8 1.8z"/>
                            <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.14 2.43C6.11 7.15 8.84 5.38 12 5.38z"/>
                            <path fill="#34A853" d="M12 22.62c3.24 0 5.95-1.08 7.93-2.91l-3.15-3.15c-1.18.79-2.69 1.26-4.78 1.26-3.89 0-7.18-2.63-8.36-6.18l-3.14 2.43c1.81 3.6 5.52 6.07 9.82 6.07z"/>
                        </svg>
                        {isRegister ? "S'inscrire avec Google" : "Se connecter avec Google"}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: '#222' }} />
                        <span style={{ fontSize: '13px', color: '#555', fontWeight: '500' }}>ou par email</span>
                        <div style={{ flex: 1, height: '1px', background: '#222' }} />
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ton@email.com" required
                                style={{
                                    width: '100%', height: '54px', padding: '0 18px',
                                    background: INPUT_BG, border: '1px solid #222',
                                    borderRadius: '16px', color: '#fff', fontSize: '15px',
                                    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"} value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isRegister ? "Mot de passe (6+ caractères)" : "Ton mot de passe"} required
                                style={{
                                    width: '100%', height: '54px', padding: '0 50px 0 18px',
                                    background: INPUT_BG, border: '1px solid #222',
                                    borderRadius: '16px', color: '#fff', fontSize: '15px',
                                    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                                }}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '18px'
                                }}
                            >
                                {showPassword ? '👁️‍🗨️' : '👁️'}
                            </button>
                        </div>

                        {!isRegister && (
                            <div style={{ textAlign: 'right' }}>
                                <button 
                                    type="button"
                                    onClick={() => router.push('/forgot-password')}
                                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer', opacity: 0.8 }}
                                >
                                    Mot de passe oublié ?
                                </button>
                            </div>
                        )}

                        {error && (
                            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', color: '#f87171', fontSize: '13px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {error}
                            </div>
                        )}

                        {successMsg && (
                            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', color: '#10b981', fontSize: '13px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                {successMsg}
                            </div>
                        )}

                        <button
                            type="submit" disabled={isLoading}
                            style={{
                                width: '100%', height: '56px',
                                background: isLoading ? '#333' : ACCENT_GRADIENT,
                                border: 'none', borderRadius: '16px',
                                color: '#fff', fontSize: '16px', fontWeight: '700',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                marginTop: '8px',
                                boxShadow: '0 4px 15px rgba(99,102,241,0.2)'
                            }}
                        >
                            {isLoading ? 'Un instant...' : isRegister ? 'Créer mon compte ✨' : 'Se connecter 🔒'}
                        </button>
                    </form>

                    <div style={{ margin: '16px 0 8px' }}>
                        <span style={{ fontSize: '13px', color: '#555' }}>
                            {isRegister ? 'déjà inscrit ?' : 'pas encore de compte ?'}
                        </span>
                    </div>

                    <button 
                        onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg('') }}
                        style={{
                            width: '100%',
                            height: '52px',
                            background: 'transparent',
                            border: '1px solid #222',
                            borderRadius: '14px',
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {isRegister ? 'Se connecter →' : 'Créer un compte gratuit ✨'}
                    </button>
                </div>

                <div style={{ marginTop: '40px', fontSize: '11px', color: '#444', lineHeight: '1.6' }}>
                    En continuant, tu acceptes nos <span style={{ textDecoration: 'underline' }}>CGU</span> et <span style={{ textDecoration: 'underline' }}>politique de confidentialité</span>
                </div>
            </div>
        </div>
    )
}