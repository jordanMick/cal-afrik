'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [isRegister, setIsRegister] = useState(false)

    const getSupabase = () => createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            const supabase = getSupabase()

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
            minHeight: '100vh', background: '#0F0A06',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', fontFamily: 'system-ui, sans-serif',
            position: 'relative',
        }}>
            <div style={{
                position: 'fixed', top: '-80px', right: '-80px',
                width: '300px', height: '300px', borderRadius: '50%',
                background: 'radial-gradient(circle, #C4622D33, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />
            <div style={{
                position: 'fixed', bottom: '-60px', left: '-60px',
                width: '240px', height: '240px', borderRadius: '50%',
                background: 'radial-gradient(circle, #E9C46A22, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />

            <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: '#C4622D', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                    }}>🌍</div>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                        Cal Afrik
                    </span>
                </div>
                <p style={{ color: '#555', fontSize: '14px' }}>Suivez vos calories, mangez africain</p>
            </div>

            <div style={{
                width: '100%', maxWidth: '400px',
                background: '#1A1108', borderRadius: '24px',
                padding: '32px', border: '1px solid #2A1F14',
                position: 'relative', zIndex: 1,
            }}>
                <div style={{
                    display: 'flex', gap: '4px', background: '#0F0A06',
                    borderRadius: '14px', padding: '4px', marginBottom: '28px',
                }}>
                    {['Se connecter', "S'inscrire"].map((tab, i) => (
                        <button key={tab}
                            onClick={() => { setIsRegister(i === 1); setError('') }}
                            style={{
                                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                                cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                                background: isRegister === (i === 1) ? '#C4622D' : 'transparent',
                                color: isRegister === (i === 1) ? '#fff' : '#555',
                                position: 'relative', zIndex: 2,
                            }}
                        >{tab}</button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', color: '#999', fontSize: '13px', marginBottom: '8px' }}>
                            Adresse email
                        </label>
                        <input type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vous@email.com" required
                            style={{
                                width: '100%', height: '48px', padding: '0 16px',
                                background: '#0F0A06', border: '1px solid #2A1F14',
                                borderRadius: '12px', color: '#fff', fontSize: '14px',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: '#999', fontSize: '13px', marginBottom: '8px' }}>
                            Mot de passe
                        </label>
                        <input type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••" required
                            style={{
                                width: '100%', height: '48px', padding: '0 16px',
                                background: '#0F0A06', border: '1px solid #2A1F14',
                                borderRadius: '12px', color: '#fff', fontSize: '14px',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px 16px', background: '#2D1010',
                            border: '1px solid #5A2020', borderRadius: '10px',
                            color: '#FF6B6B', fontSize: '13px',
                        }}>{error}</div>
                    )}

                    <button type="submit" disabled={isLoading}
                        style={{
                            width: '100%', height: '50px',
                            background: isLoading ? '#5A3520' : '#C4622D',
                            border: 'none', borderRadius: '12px',
                            color: '#fff', fontSize: '15px', fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            marginTop: '4px', position: 'relative', zIndex: 2,
                        }}
                    >
                        {isLoading ? 'Chargement...' : isRegister ? 'Créer mon compte →' : 'Se connecter →'}
                    </button>
                </form>

                {isRegister && (
                    <p style={{ color: '#444', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
                        Minimum 6 caractères pour le mot de passe
                    </p>
                )}
            </div>

            <p style={{ color: '#333', fontSize: '12px', marginTop: '24px', position: 'relative', zIndex: 1 }}>
                Cal Afrik • Fait avec ❤️ pour l'Afrique
            </p>
        </div>
    )
}