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

    const [completed, setCompleted] = useState(false)
    const [completedMsg, setCompletedMsg] = useState('')
    const [canLogNow, setCanLogNow] = useState(true)
    const [startHour, setStartHour] = useState(0)

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
                    if (json.completed) {
                        setCompleted(true)
                        setCompletedMsg(json.message)
                    } else {
                        setProposal(json.next_meal)
                        setCompleted(false)
                        setCanLogNow(json.can_log_now)
                        setStartHour(json.start_hour)
                    }
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
        <div style={{ background: '#141414', borderRadius: '20px', padding: '20px', marginBottom: '24px', height: '120px', animation: 'pulse 1.5s infinite' }} />
    )

    if (completed) {
        return (
            <div style={{ 
                background: 'rgba(16,185,129,0.05)', borderRadius: '24px', padding: '20px', marginBottom: '24px', 
                border: '0.5px solid rgba(16,185,129,0.2)', textAlign: 'center'
            }}>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#10b981' }}>{completedMsg}</p>
            </div>
        )
    }

    if (tier === 'free') {
        return null // On ne pollue plus le dashboard, on laisse le graphique gérer l'upsell
    }

    return (
        <div style={{ 
            background: '#141414', borderRadius: '24px', padding: '20px', marginBottom: '24px', 
            border: '0.5px solid #222', borderLeft: '4px solid #6366f1',
            opacity: canLogNow ? 1 : 0.8
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
                onClick={canLogNow ? handleAccept : undefined}
                disabled={!canLogNow}
                style={{ 
                    width: '100%', 
                    background: canLogNow ? '#1e1e1e' : '#111', 
                    border: '0.5px solid #333', 
                    borderRadius: '12px', 
                    color: canLogNow ? '#fff' : '#444', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    padding: '10px', 
                    cursor: canLogNow ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}
            >
                {canLogNow ? (
                    <>✅ Accepter & Enregistrer</>
                ) : (
                    <>🕒 Disponible à {startHour}:00</>
                )}
            </button>
        </div>
    )
}
