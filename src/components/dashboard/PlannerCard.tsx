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
    slot: string
}

export default function PlannerCard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'week'>('today')
    const [isRevealed, setIsRevealed] = useState(false)
    const [proposal, setProposal] = useState<Proposal | null>(null)
    const [tomorrowMenu, setTomorrowMenu] = useState<any[] | null>(null)
    const [tomorrowRevealed, setTomorrowRevealed] = useState(false)
    const [weekPlan, setWeekPlan] = useState<any[] | null>(null)
    const [weekRevealed, setWeekRevealed] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [tier, setTier] = useState<string>('free')
    const [completed, setCompleted] = useState(false)
    const [completedMsg, setCompletedMsg] = useState('')
    const [canLogNow, setCanLogNow] = useState(true)
    const [startHour, setStartHour] = useState(0)
    const [changeCount, setChangeCount] = useState(0)
    const [tomorrowChangeCount, setTomorrowChangeCount] = useState(0)
    const [weekChangeCount, setWeekChangeCount] = useState(0)

    const fetchPlan = async (view: string) => {
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
        fetchPlan(activeTab)
    }, [activeTab])

    const handleReveal = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        if (tier === 'free' && activeTab === 'today') {
            // On incrémente la vue dès la révélation
            await supabase.rpc('increment_planner_view', { user_id_input: session.user.id })
        }
        
        if (activeTab === 'today') {
            setIsRevealed(true)
            setChangeCount(0)
        }
        if (activeTab === 'tomorrow') {
            setTomorrowRevealed(true)
            setTomorrowChangeCount(0)
        }
        if (activeTab === 'week') {
            setWeekRevealed(true)
            setWeekChangeCount(0)
        }
    }

    const handleRefuse = async () => {
        if (!proposal) return
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            await fetch('/api/planner', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    slot: proposal.slot,
                    date: new Date().toISOString().split('T')[0]
                })
            })
            
            setIsRevealed(false)
            await fetchPlan('today')
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = async (target: 'today' | 'tomorrow' | 'week') => {
        if (target === 'today') {
            if (changeCount >= 3) return alert("Limite de changements atteinte (3 max).")
            setChangeCount(prev => prev + 1)
            setIsRevealed(false)
            setTimeout(() => setIsRevealed(true), 300)
        }
        if (target === 'tomorrow') {
            if (tomorrowChangeCount >= 3) return alert("Limite de changements atteinte (3 max).")
            setTomorrowChangeCount(prev => prev + 1)
            await fetchPlan('tomorrow')
        }
        if (target === 'week') {
            if (weekChangeCount >= 3) return alert("Limite de changements atteinte (3 max).")
            setWeekChangeCount(prev => prev + 1)
            await fetchPlan('week')
        }
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
                // On consomme un jeton d'action Combo 2
                if (tier === 'free') {
                    await supabase.rpc('increment_scan_feedback', { user_id_input: session.user.id })
                }
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
                        onClick={() => { setActiveTab(tab); }}
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
                        {error.includes("dîner") ? "Enregistrer mon Dîner →" : activeTab === 'tomorrow' ? "Activer le Plan Pro →" : "Passer au Premium →"}
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
                        <p style={{ fontSize: '13px', color: '#fff', fontWeight: '700', marginBottom: '4px' }}>Besoin d'inspiration ?</p>
                        <p style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>Coach Yao a une idée pour ton prochain repas</p>
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
                        {tier === 'free' && <p style={{ fontSize: '10px', color: '#555', marginTop: '8px' }}>Consomme 1 jeton</p>}
                    </div>
                ) : (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', border: '0.5px solid #222', borderLeft: '4px solid #6366f1', opacity: canLogNow ? 1 : 0.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                                <p style={{ fontSize: '10px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase' }}>Suggestion</p>
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={canLogNow ? handleAccept : undefined}
                                disabled={!canLogNow}
                                style={{ 
                                    flex: 2, background: canLogNow ? '#6366f1' : '#111', border: 'none', 
                                    borderRadius: '12px', color: canLogNow ? '#fff' : '#444', fontSize: '12px', fontWeight: '600', 
                                    padding: '12px', cursor: canLogNow ? 'pointer' : 'default'
                                }}
                            >
                                {canLogNow ? <>✅ Valider</> : <>🕒 Demain à {startHour}:00</>}
                            </button>
                            {tier === 'free' ? (
                                <button 
                                    onClick={handleRefuse}
                                    style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}
                                >
                                    Sauter
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleChange('today')}
                                    style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '12px', color: '#888', fontSize: '12px', fontWeight: '600' }}
                                >
                                    Changer ({3 - changeCount})
                                </button>
                            )}
                        </div>
                    </div>
                )
            ) : activeTab === 'tomorrow' ? (
                !tomorrowRevealed ? (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '32px', border: '0.5px solid #222', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', color: '#fff', fontWeight: '700', marginBottom: '16px' }}>Voir le menu complet de demain ?</p>
                        <button onClick={handleReveal} style={{ background: '#1e1e1e', border: '0.5px solid #333', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '700', padding: '10px 20px', cursor: 'pointer' }}>
                            Révéler le menu
                        </button>
                    </div>
                ) : (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', border: '0.5px solid #222' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <p style={{ fontSize: '11px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase' }}>Menu de demain</p>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                {tier !== 'free' && (
                                    <span onClick={() => handleChange('tomorrow')} style={{ fontSize: '10px', color: '#6366f1', cursor: 'pointer', fontWeight: '700' }}>
                                        Regénérer ({3 - tomorrowChangeCount})
                                    </span>
                                )}
                                <span onClick={() => setTomorrowRevealed(false)} style={{ fontSize: '10px', color: '#555', cursor: 'pointer' }}>Masquer</span>
                            </div>
                        </div>
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
                )
            ) : (
                !weekRevealed ? (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '32px', border: '0.5px solid #222', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', color: '#fff', fontWeight: '700', marginBottom: '16px' }}>Générer ton planning hebdomadaire ?</p>
                        <button onClick={handleReveal} style={{ background: '#1e1e1e', border: '0.5px solid #333', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '700', padding: '10px 20px', cursor: 'pointer' }}>
                            Générer la semaine
                        </button>
                    </div>
                ) : (
                    <div style={{ background: '#141414', borderRadius: '24px', padding: '20px', border: '0.5px solid #222' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <p style={{ fontSize: '11px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase' }}>Ta semaine</p>
                            <span onClick={() => setWeekRevealed(false)} style={{ fontSize: '10px', color: '#555', cursor: 'pointer' }}>Masquer</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {weekPlan?.map((w, idx) => (
                                <div key={idx} style={{ background: '#1a1a1a', padding: '12px', borderRadius: '12px', border: '0.5px solid #333' }}>
                                    <p style={{ fontSize: '10px', color: '#6366f1', fontWeight: '800' }}>{w.day}</p>
                                    <p style={{ fontSize: '11px', color: '#fff', marginTop: '4px' }}>{w.main_dish}</p>
                                </div>
                            ))}
                        </div>
                        {tier !== 'free' && (
                            <button 
                                onClick={() => handleChange('week')} 
                                style={{ width: '100%', background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: '700', marginTop: '16px', padding: '10px' }}
                            >
                                Refaire mon planning ({3 - weekChangeCount} restants)
                            </button>
                        )}
                    </div>
                )
            )}
        </div>
    )
}
