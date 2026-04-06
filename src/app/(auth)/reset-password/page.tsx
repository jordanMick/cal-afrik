'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    useEffect(() => {
        const handleSession = async () => {
            const hash = window.location.hash

            if (hash) {
                const access_token = new URLSearchParams(hash.replace('#', '')).get('access_token')
                const refresh_token = new URLSearchParams(hash.replace('#', '')).get('refresh_token')

                if (access_token && refresh_token) {
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    })

                    if (error) {
                        console.error("Erreur session:", error.message)
                    }
                }
            }
        }

        handleSession()
    }, [])

    const handleReset = async () => {
        if (password !== confirm) {
            setMessage("Les mots de passe ne correspondent pas")
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.updateUser({
            password: password,
        })

        if (error) {
            setMessage(error.message)
        } else {
            setMessage("Mot de passe mis à jour ✅")
            setTimeout(() => {
                router.push('/login')
            }, 2000)
        }

        setLoading(false)
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'system-ui'
        }}>
            <div style={{
                background: '#141414',
                padding: '30px',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h2 style={{ marginBottom: '20px' }}>
                    Nouveau mot de passe
                </h2>

                <input
                    type="password"
                    placeholder="Nouveau mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                        width: '100%',
                        height: '45px',
                        marginBottom: '10px',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1px solid #333',
                        background: '#0a0a0a',
                        color: '#fff'
                    }}
                />

                <input
                    type="password"
                    placeholder="Confirmer"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    style={{
                        width: '100%',
                        height: '45px',
                        marginBottom: '15px',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1px solid #333',
                        background: '#0a0a0a',
                        color: '#fff'
                    }}
                />

                {message && (
                    <p style={{ fontSize: '13px', marginBottom: '10px', color: '#888' }}>
                        {message}
                    </p>
                )}

                <button
                    onClick={handleReset}
                    disabled={loading}
                    style={{
                        width: '100%',
                        height: '45px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#6366f1',
                        color: '#fff',
                        cursor: 'pointer'
                    }}
                >
                    {loading ? '...' : 'Changer le mot de passe'}
                </button>
            </div>
        </div>
    )
}