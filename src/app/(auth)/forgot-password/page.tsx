'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
            setMessage('Lien envoyé ! Vérifiez votre boîte mail.')
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui' }}>
            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />

                <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#666', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', cursor: 'pointer', padding: 0 }}>
                    ← Retour
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🔐</div>
                    <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>Mot de passe oublié</h1>
                </div>
                <p style={{ color: '#555', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
                    Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>

                <form onSubmit={handleSendReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', color: '#666', fontSize: '12px', marginBottom: '6px', fontWeight: '500' }}>Adresse email</label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="votre@email.com" required
                            style={{
                                width: '100%', height: '46px', padding: '0 14px',
                                background: '#0a0a0a', border: '0.5px solid #2a2a2a',
                                borderRadius: '10px', color: '#fff', fontSize: '14px',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {message && (
                        <div style={{
                            padding: '12px', borderRadius: '10px',
                            background: message.includes('Vérifiez') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            border: `0.5px solid ${message.includes('Vérifiez') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            color: message.includes('Vérifiez') ? '#10b981' : '#f87171',
                            fontSize: '13px', lineHeight: '1.5'
                        }}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        style={{
                            width: '100%', height: '48px',
                            background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #6366f1, #10b981)',
                            border: 'none', borderRadius: '12px',
                            color: loading ? '#444' : '#fff', fontSize: '14px', fontWeight: '700',
                            cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px'
                        }}
                    >
                        {loading ? 'Envoi...' : 'Envoyer le lien →'}
                    </button>
                </form>
            </div>
        </div>
    )
}
