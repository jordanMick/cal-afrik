'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Proposal {
    name: string
    kcal: number
    protein: number
    carbs: number
    fat: number
}

export default function PlannerCard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [tier, setTier] = useState<string>('free')

    const handleAccept = async () => {
        if (!proposal) return
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/meals', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    custom_name: proposal.name,
                    calories: proposal.kcal,
                    protein_g: proposal.protein,
                    carbs_g: proposal.carbs,
                    fat_g: proposal.fat,
                    portion_g: 300, // Portion standard par défaut
                    ai_confidence: 100,
                    coach_message: "Repas validé depuis ton planning Coach Yao."
                })
            })

            if (res.ok) {
                alert('✅ Repas ajouté à ton journal !')
                // On pourrait ici rafraîchir le store global si nécessaire
                window.location.reload() 
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                const res = await fetch('/api/planner', {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                })
                const json = await res.json()

                if (json.success) {
                    setProposal(json.next_meal)
                    setTier(json.tier)
                } else if (json.code === 'PREMIUM_ONLY') {
                    setTier('free')
                } else {
                    setError(json.error)
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchPlan()
    }, [])

    if (loading) return (
        <div style={{ background: '#141414', borderRadius: '20px', padding: '20px', marginBottom: '24px', height: '120px', animation: 'pulse 2s infinite' }} />
    )

    if (tier === 'free') {
        return (
            <div style={{ 
                background: '#141414', borderRadius: '24px', padding: '20px', marginBottom: '24px', 
                border: '0.5px solid #222', position: 'relative', overflow: 'hidden' 
            }}>
                <div style={{ filter: 'blur(8px)', opacity: 0.3 }}>
                    <p style={{ fontSize: '11px', color: '#6366f1', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Prochain Repas Suggeré</p>
                    <p style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>Riz au gras et poulet...</p>
                </div>
                
                <div style={{ 
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', 
                    alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.4)', zIndex: 2 
                }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>GPS Nutritionnel 🚀</p>
                    <p style={{ fontSize: '10px', color: '#aaa', marginBottom: '12px' }}>Ne réfléchis plus, Coach Yao planifie pour toi.</p>
                    <button 
                        onClick={() => router.push('/upgrade')}
                        style={{ 
                            background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', 
                            borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '700', 
                            padding: '6px 14px', cursor: 'pointer' 
                        }}
                    >
                        Débloquer
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{ 
            background: '#141414', borderRadius: '24px', padding: '20px', marginBottom: '24px', 
            border: '0.5px solid #222', borderLeft: '4px solid #6366f1'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <p style={{ fontSize: '10px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggestion Coach Yao</p>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginTop: '4px' }}>{proposal?.name}</h3>
                </div>
                <div style={{ background: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1' }}>{proposal?.kcal} kcal</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#555' }}>P: <span style={{ color: '#aaa' }}>{proposal?.protein}g</span></div>
                <div style={{ fontSize: '11px', color: '#555' }}>G: <span style={{ color: '#aaa' }}>{proposal?.carbs}g</span></div>
                <div style={{ fontSize: '11px', color: '#555' }}>L: <span style={{ color: '#aaa' }}>{proposal?.fat}g</span></div>
            </div>

            <button 
                onClick={handleAccept}
                style={{ 
                    width: '100%', background: '#1e1e1e', border: '0.5px solid #333', 
                    borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '600', 
                    padding: '10px', cursor: 'pointer', transition: 'all 0.2s'
                }}
            >
                ✅ Accepter & Enregistrer
            </button>
        </div>
    )
}
