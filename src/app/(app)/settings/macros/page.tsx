'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Target, Crown, Info, RefreshCcw } from 'lucide-react'
import { useAppStore, MealSlotKey, SLOT_LABELS } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'
import { useState, useEffect } from 'react'

const NUTRIENTS = [
    { id: 'calories', label: 'Calories', color: 'var(--text-primary)' },
    { id: 'protein', label: 'Protéines', color: 'var(--accent)' },
    { id: 'carbs', label: 'Glucides', color: 'var(--warning)' },
    { id: 'fat', label: 'Lipides', color: 'var(--success)' },
]

const SLOT_ORDER: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']

export default function MacroStrategyPage() {
    const router = useRouter()
    const { profile, macroDistributions, updateMacroDistribution } = useAppStore()
    const [activeNutrient, setActiveNutrient] = useState('calories')
    const effectiveTier = getEffectiveTier(profile)

    // Si pas premium, on redirige ou on bloque
    useEffect(() => {
        if (effectiveTier !== 'premium') {
            // router.push('/settings/subscription')
        }
    }, [effectiveTier, router])

    const currentDist = macroDistributions[activeNutrient]
    const total = SLOT_ORDER.reduce((sum, s) => sum + currentDist[s], 0)
    const isInvalid = Math.abs(total - 1) > 0.01

    const handleSliderChange = (slot: MealSlotKey, val: number) => {
        updateMacroDistribution(activeNutrient, slot, val)
    }

    const resetToDefault = () => {
        const defaults = {
            petit_dejeuner: 0.25,
            dejeuner: 0.35,
            collation: 0.10,
            diner: 0.30,
        }
        SLOT_ORDER.forEach(s => updateMacroDistribution(activeNutrient, s, defaults[s]))
    }

    if (effectiveTier !== 'premium') {
        return (
             <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--warning-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <Crown size={40} color="var(--warning)" />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '16px' }}>Fonctionnalité Premium</h1>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
                    La personnalisation avancée des cibles par repas est réservée aux abonnés Premium Cal-Afrik.
                </p>
                <button onClick={() => router.push('/settings/subscription')} style={{ width: '100%', padding: '18px', background: 'var(--warning)', borderRadius: '20px', color: '#fff', border: 'none', fontSize: '16px', fontWeight: '800', cursor: 'pointer' }}>
                    Découvrir le Premium
                </button>
                <button onClick={() => router.back()} style={{ marginTop: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                    Retour
                </button>
             </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Stratégie nutritionnelle</h1>
            </div>

            <div style={{ padding: '0 20px' }}>
                <div style={{ background: 'rgba(var(--accent-rgb), 0.05)', border: '1px solid rgba(var(--accent-rgb), 0.1)', borderRadius: '20px', padding: '16px', display: 'flex', gap: '14px', marginBottom: '24px' }}>
                    <Info size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Répartissez vos objectifs quotidiens sur les différents repas. Le total doit idéalement atteindre 100%.
                    </p>
                </div>

                {/* Tabs Nutriments */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {NUTRIENTS.map(n => (
                        <button
                            key={n.id}
                            onClick={() => setActiveNutrient(n.id)}
                            style={{
                                padding: '10px 18px',
                                borderRadius: '14px',
                                background: activeNutrient === n.id ? n.color : 'var(--bg-secondary)',
                                color: activeNutrient === n.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                border: activeNutrient === n.id ? 'none' : '0.5px solid var(--border-color)',
                                fontSize: '13px',
                                fontWeight: '800',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: activeNutrient === n.id ? `0 8px 16px ${n.color}30` : 'none',
                                transform: activeNutrient === n.id ? 'scale(1.05)' : 'scale(1)'
                            }}
                        >
                            {n.label}
                        </button>
                    ))}
                </div>

                {/* Sliders Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {SLOT_ORDER.map(slot => {
                        const val = currentDist[slot]
                        return (
                            <div key={slot}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{SLOT_LABELS[slot]}</span>
                                    <span style={{ fontSize: '15px', fontWeight: '800', color: NUTRIENTS.find(n => n.id === activeNutrient)?.color }}>
                                        {Math.round(val * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={val}
                                    onChange={(e) => handleSliderChange(slot, parseFloat(e.target.value))}
                                    style={{
                                        width: '100%',
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: 'var(--bg-tertiary)',
                                        outline: 'none',
                                        accentColor: NUTRIENTS.find(n => n.id === activeNutrient)?.color,
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                        )
                    })}
                </div>

                {/* Status Bar */}
                <div style={{
                    marginTop: '40px',
                    padding: '20px',
                    borderRadius: '24px',
                    background: isInvalid ? 'rgba(var(--danger-rgb), 0.05)' : 'rgba(var(--success-rgb), 0.05)',
                    border: `1px solid ${isInvalid ? 'var(--danger)' : 'var(--success)'}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px'
                }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Total réparti</p>
                        <p style={{ color: isInvalid ? 'var(--danger)' : 'var(--success)', fontSize: '24px', fontWeight: '900' }}>
                            {Math.round(total * 100)}%
                        </p>
                    </div>
                    <button 
                        onClick={resetToDefault}
                        style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                        <RefreshCcw size={14} /> Réinitialiser
                    </button>
                </div>

                {isInvalid && (
                    <p style={{ color: 'var(--danger)', fontSize: '12px', textAlign: 'center', fontWeight: '500' }}>
                        Le total doit être de 100% pour une répartition correcte.
                    </p>
                )}

                <button
                    onClick={() => router.back()}
                    style={{
                        width: '100%', padding: '18px', background: isInvalid ? 'var(--bg-tertiary)' : 'var(--text-primary)',
                        borderRadius: '20px', color: 'var(--bg-primary)', border: 'none', fontSize: '16px',
                        fontWeight: '800', cursor: 'pointer', marginTop: '20px', opacity: isInvalid ? 0.5 : 1
                    }}
                    disabled={isInvalid}
                >
                    Enregistrer la stratégie
                </button>
            </div>
        </div>
    )
}
