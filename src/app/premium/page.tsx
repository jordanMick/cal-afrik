'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PremiumPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handlePayment = async () => {
        console.log("CLICK OK") // 🔥 DEBUG

        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                alert("Tu dois être connecté")
                setLoading(false)
                return
            }

            console.log("USER:", user.email) // 🔥 DEBUG

            const res = await fetch('/api/fedapay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: user.email
                })
            })

            console.log("RESPONSE STATUS:", res.status) // 🔥 DEBUG

            const json = await res.json()
            console.log("API RESPONSE:", JSON.stringify(json, null, 2)) // 🔥 DEBUG

            if (json.success && json.data?.url) {
                window.location.href = json.data.url
            } else {
                alert("Erreur lors du paiement")
            }

        } catch (err) {
            console.error("ERROR:", err)
            alert("Erreur serveur")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0F0A06',
            color: '#fff',
            padding: '24px',
            maxWidth: '480px',
            margin: '0 auto'
        }}>

            <h1 style={{
                fontSize: '28px',
                fontWeight: '800',
                marginBottom: '20px'
            }}>
                🚀 Passe à Premium
            </h1>

            <p style={{ color: '#aaa', marginBottom: '30px' }}>
                Débloque toute la puissance de Cal-Afrik
            </p>

            <div style={{ marginBottom: '30px' }}>
                <p>✅ Scans illimités</p>
                <p>✅ Résultats plus précis</p>
                <p>✅ Accès complet aux données nutritionnelles</p>
                <p>✅ Suivi de ton alimentation</p>
            </div>

            <div style={{
                background: '#1A1108',
                padding: '20px',
                borderRadius: '16px',
                marginBottom: '30px'
            }}>
                <p style={{ fontSize: '24px', fontWeight: '700' }}>
                    1 500 FCFA / mois
                </p>
            </div>

            <button
                onClick={handlePayment}
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    background: loading ? '#555' : '#C4622D',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    cursor: 'pointer'
                }}
            >
                {loading ? "Chargement..." : "🔓 Débloquer maintenant"}
            </button>

            <button
                onClick={() => router.back()}
                style={{
                    marginTop: '15px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'transparent',
                    border: '1px solid #333',
                    color: '#aaa'
                }}
            >
                Retour
            </button>
        </div>
    )
}