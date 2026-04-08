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
    const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'week'>('today')
    const [isRevealed, setIsRevealed] = useState(false)
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [tomorrowMenu, setTomorrowMenu] = useState<any[] | null>(null)
    const [weekPlan, setWeekPlan] = useState<any[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [tier, setTier] = useState<string>('free')
    const [completed, setCompleted] = useState(false)
    const [completedMsg, setCompletedMsg] = useState('')
    const [canLogNow, setCanLogNow] = useState(true)
    const [startHour, setStartHour] = useState(0)

    const fetchPlan = async (view: string, reveal = false) => {
        setLoading(true)
        setError(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch(`/api/planner?view=${view}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()

            if (json.success) {
                if (view === 'today') {
                    if (json.completed) {
                        setCompleted(true)
                        setCompletedMsg(json.message)
                    } else {
                        setProposal(json.next_meal)
                        setCompleted(false)
                        setCanLogNow(json.can_log_now)
                        setStartHour(json.start_hour)
                        if (reveal) setIsRevealed(true)
                    }
                } else if (view === 'tomorrow') {
                    setTomorrowMenu(json.menu)
                } else if (view === 'week') {
                    setWeekPlan(json.days)
                }
                setTier(json.tier)
            } else {
                setError(json.error)
            }
        } catch (err) {
            console.error(err)
            setError("Erreur de connexion")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'today') {
            // Pour aujourd'hui, on ne charge les métadonnées sans révéler
            fetchPlan('today', false)
        } else {
            fetchPlan(activeTab, true)
        }
    }, [activeTab])

    const handleReveal = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session && tier === 'free') {
            await supabase.rpc('increment_scan_feedback', { user_id_input: session.user.id })
        }
        setIsRevealed(true)
    }

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
                    portion_g: 300, 
                    ai_confidence: 100,
                    coach_message: "Repas validé depuis ton planning Coach Yao."
                })
            })

            if (res.ok) {
                alert('✅ Repas ajouté à ton journal !')
                window.location.reload() 
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {(['today', 'tomorrow', 'week'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setIsRevealed(false); }}
                        style={{
                            background: activeTab === tab ? '#6366f1' : '#1a1a1a',
                            border: '0.5px solid #333',
                            borderRadius: '10px',
                            color: activeTab === tab ? '#fff' : '#888',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'today' ? "Aujourd'hui" : tab === 'tomorrow' ? "Demain" : "Semaine"}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', height: '140px', animation: 'pulse 1.5s infinite', border: '0.5px solid #222' }} />
            ) : error ? (
                <div style={{ background: '#141414', borderRadius: '24px', padding: '24px', border: '0.5px solid #222', textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', marginBottom: '8px' }}>🔒</p>
                    <p style={{ fontSize: '13px', color: '#fff', fontWeight: '600', marginBottom: '4px' }}>{error}</p>
                    <button 
                        onClick={() => router.push('/upgrade')}
                        style={{ color: '#6366f1', fontSize: '11px', fontWeight: '700', border: 'none', background: 'none', cursor: 'pointer', marginTop: '8px' }}
                    >
                        {activeTab === 'tomorrow' ? "Débloquer le Plan Pro →" : "Débloquer le Plan Premium →"}
                    </button>
                </div>
            ) : activeTab === 'today' ? (
                completed ? (
                    <div style={{ background: 'rgba(16,185,129,0.05)', borderRadius: '24px', padding: '20px', border: '0.5px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                        <p style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</p>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#10b981' }}>{completedMsg}</p>
                    </div>
                ) : !isRevealed ? (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '24px', border: '0.5px solid #222', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', color: '#fff', fontWeight: '700', marginBottom: '12px' }}>Coach Yao a une idée pour ton prochain repas...</p>
                        <button 
                            onClick={handleReveal}
                            style={{ 
                                background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', 
                                borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '700', 
                                padding: '10px 20px', cursor: 'pointer', transition: 'all 0.2s' 
                            }}
                        >
                            Découvrir la suggestion
                        </button>
                        {tier === 'free' && <p style={{ fontSize: '10px', color: '#555', marginTop: '8px' }}>Ceci utilisera 1 de tes 2 jetons quotidiens</p>}
                    </div>
                ) : (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', border: '0.5px solid #222', borderLeft: '4px solid #6366f1', opacity: canLogNow ? 1 : 0.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                                <p style={{ fontSize: '10px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase' }}>Prochain Repas</p>
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
                                width: '100%', background: canLogNow ? '#1e1e1e' : '#111', border: '0.5px solid #333', 
                                borderRadius: '12px', color: canLogNow ? '#fff' : '#444', fontSize: '12px', fontWeight: '600', 
                                padding: '10px', cursor: canLogNow ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            {canLogNow ? <>✅ Valider ce repas</> : <>🕒 Disponible à {startHour}:00</>}
                        </button>
                    </div>
                )
            ) : activeTab === 'tomorrow' ? (
                <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', border: '0.5px solid #222' }}>
                    <p style={{ fontSize: '11px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', marginBottom: '16px' }}>Menu de demain</p>
                    {tomorrowMenu?.map((m, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < 3 ? '0.5px solid #222' : 'none' }}>
                            <div>
                                <p style={{ fontSize: '10px', color: '#888', textTransform: 'capitalize' }}>{m.slot.replace('_', ' ')}</p>
                                <p style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{m.name}</p>
                            </div>
                            <p style={{ fontSize: '12px', color: '#aaa', fontWeight: '700' }}>{m.kcal} kcal</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', border: '0.5px solid #222' }}>
                    <p style={{ fontSize: '11px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', marginBottom: '16px' }}>Ta semaine</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {weekPlan?.map((w, idx) => (
                            <div key={idx} style={{ background: '#1a1a1a', padding: '12px', borderRadius: '12px', border: '0.5px solid #333' }}>
                                <p style={{ fontSize: '10px', color: '#6366f1', fontWeight: '800' }}>{w.day}</p>
                                <p style={{ fontSize: '11px', color: '#fff', marginTop: '4px' }}>{w.main_dish}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
