'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [isRegister, setIsRegister] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        try {
            if (isRegister) {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) { setError(error.message); return }
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
                if (signInError) { setError(signInError.message); return }
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

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden',
        }}>

            {/* Halos colorés d'ambiance */}
            <div style={{
                position: 'fixed', top: '-100px', right: '-100px',
                width: '350px', height: '350px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'fixed', bottom: '-80px', left: '-60px',
                width: '280px', height: '280px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'fixed', top: '50%', left: '-40px',
                width: '180px', height: '180px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            {/* LOGO */}
            <div style={{ textAlign: 'center', marginBottom: '36px', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #6366f1, #10b981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px',
                    }}>🌍</div>
                    <span style={{ fontSize: '26px', fontWeight: '700', color: '#fff', letterSpacing: '-0.5px' }}>
                        Cal Afrik
                    </span>
                </div>
                <p style={{ color: '#555', fontSize: '14px' }}>Suivez vos calories, mangez bien</p>
            </div>

            {/* CARD */}
            <div style={{
                width: '100%', maxWidth: '400px',
                background: '#141414',
                borderRadius: '24px',
                padding: '28px',
                border: '0.5px solid #222',
                position: 'relative', zIndex: 1,
            }}>

                {/* Ligne déco en haut de la card */}
                <div style={{
                    position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px',
                    background: 'linear-gradient(90deg, #6366f1, #10b981, #f59e0b)',
                    borderRadius: '0 0 4px 4px',
                }} />

                {/* TABS */}
                <div style={{
                    display: 'flex', gap: '4px',
                    background: '#0a0a0a',
                    borderRadius: '12px', padding: '4px', marginBottom: '24px',
                }}>
                    {['Se connecter', "S'inscrire"].map((tab, i) => (
                        <button key={tab}
                            onClick={() => { setIsRegister(i === 1); setError('') }}
                            style={{
                                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                                cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                                background: isRegister === (i === 1)
                                    ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                                    : 'transparent',
                                color: isRegister === (i === 1) ? '#fff' : '#555',
                                transition: 'all 0.2s',
                            }}
                        >{tab}</button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    <div>
                        <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>
                            Adresse email
                        </label>
                        <input
                            type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vous@email.com" required
                            style={{
                                width: '100%', height: '46px', padding: '0 14px',
                                background: '#0a0a0a', border: '0.5px solid #2a2a2a',
                                borderRadius: '10px', color: '#fff', fontSize: '14px',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>
                            Mot de passe
                        </label>
                        <input
                            type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••" required
                            style={{
                                width: '100%', height: '46px', padding: '0 14px',
                                background: '#0a0a0a', border: '0.5px solid #2a2a2a',
                                borderRadius: '10px', color: '#fff', fontSize: '14px',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                        {!isRegister && (
                            <div style={{ textAlign: 'right', marginTop: '8px' }}>
                                <button 
                                    type="button"
                                    onClick={() => router.push('/forgot-password')}
                                    style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', padding: '4px' }}
                                >
                                    Mot de passe oublié ?
                                </button>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div style={{
                            padding: '11px 14px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '0.5px solid rgba(239,68,68,0.3)',
                            borderRadius: '10px', color: '#f87171', fontSize: '13px',
                        }}>{error}</div>
                    )}

                    <button
                        type="submit" disabled={isLoading}
                        style={{
                            width: '100%', height: '48px',
                            background: isLoading
                                ? '#1e1e1e'
                                : 'linear-gradient(135deg, #6366f1, #10b981)',
                            border: 'none', borderRadius: '12px',
                            color: isLoading ? '#444' : '#fff',
                            fontSize: '14px', fontWeight: '600',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            marginTop: '4px',
                            letterSpacing: '0.01em',
                        }}
                    >
                        {isLoading ? 'Chargement...' : isRegister ? 'Créer mon compte →' : 'Se connecter →'}
                    </button>
                </form>

                {isRegister && (
                    <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', marginTop: '14px' }}>
                        Minimum 6 caractères pour le mot de passe
                    </p>
                )}
            </div>

            {/* Features rapides */}
            <div style={{
                display: 'flex', gap: '16px', marginTop: '28px',
                position: 'relative', zIndex: 1,
            }}>
                {[
                    { icon: '📷', label: 'Scan IA', color: '#6366f1' },
                    { icon: '📊', label: 'Suivi', color: '#10b981' },
                    { icon: '🎯', label: 'Objectifs', color: '#f59e0b' },
                ].map(f => (
                    <div key={f.label} style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: `${f.color}18`,
                            border: `0.5px solid ${f.color}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', margin: '0 auto 4px',
                        }}>{f.icon}</div>
                        <p style={{ color: '#444', fontSize: '11px' }}>{f.label}</p>
                    </div>
                ))}
            </div>

            <p style={{ color: '#2a2a2a', fontSize: '12px', marginTop: '24px', position: 'relative', zIndex: 1 }}>
                Cal Afrik • Fait avec ❤️ pour l'Afrique
            </p>
        </div>
    )
}