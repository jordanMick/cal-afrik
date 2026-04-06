'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [ready, setReady] = useState(false)

    const router = useRouter()

    useEffect(() => {
        const tryVerify = async () => {
            // Méthode 1 : token_hash en query param (nouveau système Supabase)
            const searchParams = new URLSearchParams(window.location.search)
            const token_hash = searchParams.get('token_hash')
            const type = searchParams.get('type')

            if (token_hash && type === 'recovery') {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash,
                    type: 'recovery',
                })
                if (error) {
                    setMessage('Lien invalide ou expiré. Redemandez un reset.')
                } else {
                    setReady(true)
                }
                return
            }

            // Méthode 2 : access_token dans le hash de l'URL (ancien système)
            const hash = window.location.hash
            if (hash) {
                const hashParams = new URLSearchParams(hash.substring(1))
                const access_token = hashParams.get('access_token')
                const refresh_token = hashParams.get('refresh_token')

                if (access_token) {
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token: refresh_token || '',
                    })
                    if (error) {
                        setMessage('Lien invalide ou expiré. Redemandez un reset.')
                    } else {
                        setReady(true)
                    }
                    return
                }
            }

            // Aucun token trouvé
            setMessage('Lien invalide. Redemandez un reset de mot de passe.')
        }

        tryVerify()
    }, [])

    const handleReset = async () => {
        if (!password) {
            setMessage('Entrez un nouveau mot de passe')
            return
        }
        if (password !== confirm) {
            setMessage('Les mots de passe ne correspondent pas')
            return
        }
        if (password.length < 6) {
            setMessage('Le mot de passe doit faire au moins 6 caractères')
            return
        }

        setLoading(true)
        setMessage('')

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setMessage(error.message)
            setLoading(false)
        } else {
            setMessage('Mot de passe mis à jour !')
            setTimeout(() => router.push('/login'), 1500)
        }
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        height: '46px',
        padding: '0 14px',
        background: '#0f0f0f',
        border: '0.5px solid #2a2a2a',
        borderRadius: '10px',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    }

    if (!ready && !message) {
        return (
            <div style={{
                height: '100vh', background: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '12px', color: '#555', fontFamily: 'system-ui',
            }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🌍</div>
                <p style={{ fontSize: '13px' }}>Vérification sécurisée...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui' }}>
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '20px', padding: '32px 24px', width: '100%', maxWidth: '400px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>🌍</div>
                    <span style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>Cal Afrik</span>
                </div>

                {!ready && message ? (
                    <>
                        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>Lien expiré</h2>
                        <p style={{ color: '#555', fontSize: '13px', marginBottom: '24px' }}>Ce lien de réinitialisation est invalide ou a expiré.</p>
                        <p style={{ fontSize: '13px', color: '#ef4444', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '0.5px solid rgba(239,68,68,0.2)', marginBottom: '20px' }}>{message}</p>
                        <button onClick={() => router.push('/login')} style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #10b981)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                            Retour à la connexion
                        </button>
                    </>
                ) : (
                    <>
                        <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>Nouveau mot de passe</h2>
                        <p style={{ color: '#555', fontSize: '13px', marginBottom: '24px' }}>Choisissez un mot de passe sécurisé</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
                                style={{ ...inputStyle, border: password ? '0.5px solid rgba(99,102,241,0.6)' : '0.5px solid #2a2a2a' }} />
                            <input type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                style={{ ...inputStyle, border: confirm ? (confirm === password ? '0.5px solid rgba(16,185,129,0.6)' : '0.5px solid rgba(239,68,68,0.6)') : '0.5px solid #2a2a2a' }} />
                        </div>

                        {message && (
                            <p style={{ fontSize: '13px', marginTop: '12px', color: message.includes('!') ? '#10b981' : '#ef4444', padding: '10px 12px', background: message.includes('!') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '8px', border: `0.5px solid ${message.includes('!') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                {message}
                            </p>
                        )}

                        <button onClick={handleReset} disabled={loading} style={{ width: '100%', height: '48px', marginTop: '20px', borderRadius: '12px', border: 'none', background: loading ? '#1e1e1e' : 'linear-gradient(135deg, #6366f1, #10b981)', color: loading ? '#444' : '#fff', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
                            {loading ? 'Mise à jour...' : 'Changer le mot de passe'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}