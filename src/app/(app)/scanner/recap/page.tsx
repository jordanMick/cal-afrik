'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'

interface VitaminEntry {
    name: string
    value: string
    percentage: number
}

interface RecapData {
    mealName: string
    imageUrl: string | null
    totalCalories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    portion_g: number
    healthScore: number | null
    vitamins: VitaminEntry[]
    coachMessage: string
    slotKey: string
    selectedFoods: any[]
    capturedImage: string | null
    aiConfidence: number
}

export default function ScanRecapPage() {
    const router = useRouter()
    const { addMeal, profile, slots, dailyCalories } = useAppStore()

    const [data, setData] = useState<RecapData | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [showVitamins, setShowVitamins] = useState(false)

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('scan_recap')
            if (!raw) { router.replace('/scanner'); return }
            setData(JSON.parse(raw))
        } catch {
            router.replace('/scanner')
        }
    }, [])

    if (!data) return null

    const currentSlotKey = (data.slotKey as MealSlotKey) || getMealSlot(new Date().getHours())
    const slotLabel = SLOT_LABELS[currentSlotKey] || 'Repas'
    const calorieTarget = profile?.calorie_target ?? 2000
    const dailyConsumed = dailyCalories
    const remaining = calorieTarget - dailyConsumed - data.totalCalories
    const exceeded = remaining < 0

    const tier = getEffectiveTier(profile)

    const scoreColor = data.healthScore
        ? data.healthScore >= 7 ? '#10b981' : data.healthScore >= 5 ? '#f59e0b' : '#ef4444'
        : '#f59e0b'

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/meals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    custom_name: data.mealName,
                    meal_type: currentSlotKey,
                    portion_g: Math.round(data.portion_g),
                    calories: Math.round(data.totalCalories),
                    protein_g: Math.round(data.protein_g * 10) / 10,
                    carbs_g: Math.round(data.carbs_g * 10) / 10,
                    fat_g: Math.round(data.fat_g * 10) / 10,
                    image_url: data.capturedImage,
                    ai_confidence: data.aiConfidence,
                    coach_message: data.coachMessage || null,
                    is_suggestion: false,
                    health_score: data.healthScore,
                    vitamins: data.vitamins,
                })
            })
            const json = await res.json()
            if (json.success && json.data) {
                addMeal(json.data)
                sessionStorage.removeItem('scan_recap')
                sessionStorage.removeItem('scan_state_backup')
                router.push('/journal')
            } else if (json.code === 'LIMIT_REACHED') {
                router.push('/upgrade')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSaving(false)
        }
    }

    const macros = [
        { label: 'Glucides', value: data.carbs_g, color: 'var(--accent)', track: 'rgba(var(--accent-rgb),0.15)' },
        { label: 'Protéines', value: data.protein_g, color: '#10b981', track: 'rgba(16,185,129,0.15)' },
        { label: 'Lipides', value: data.fat_g, color: '#f59e0b', track: 'rgba(245,158,11,0.15)' },
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

            {/* ── HERO IMAGE ─────────────────────────────────── */}
            <div style={{ position: 'relative', width: '100%', height: '52vh', flexShrink: 0, overflow: 'hidden' }}>
                {data.imageUrl ? (
                    <motion.img
                        initial={{ scale: 1.06, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        src={data.imageUrl}
                        alt={data.mealName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🍽️</div>
                )}

                {/* Dégradé bas */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 35%, var(--bg-primary) 100%)' }} />

                {/* Bouton retour */}
                <button
                    onClick={() => router.back()}
                    style={{ position: 'absolute', top: '20px', left: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <ArrowLeft size={18} />
                </button>

                {/* Badge créneau */}
                <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', border: '0.5px solid rgba(var(--accent-rgb),0.4)', borderRadius: '20px', padding: '5px 12px' }}>
                    <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '700' }}>{slotLabel}</span>
                </div>

                {/* Nom du plat sur l'image */}
                <div style={{ position: 'absolute', bottom: '28px', left: '20px', right: '20px' }}>
                    <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.4px', textShadow: '0 2px 12px rgba(0,0,0,0.5)', margin: 0 }}>
                        {data.mealName}
                    </h1>
                </div>
            </div>

            {/* ── CONTENU ────────────────────────────────────── */}
            <div style={{ flex: 1, padding: '24px 20px 120px', overflowY: 'auto' }}>

                {/* Calories + restant */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: '18px', padding: '18px', textAlign: 'center', border: '0.5px solid rgba(var(--accent-rgb),0.2)' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Calories</p>
                        <p style={{ color: 'var(--accent)', fontSize: '38px', fontWeight: '800', letterSpacing: '-1.5px', lineHeight: 1 }}>{Math.round(data.totalCalories)}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>kcal</p>
                    </div>
                    <div style={{ flex: 1, background: exceeded ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)', borderRadius: '18px', padding: '18px', textAlign: 'center', border: `0.5px solid ${exceeded ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}` }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Restant journée</p>
                        <p style={{ color: exceeded ? '#ef4444' : 'var(--text-primary)', fontSize: '38px', fontWeight: '800', letterSpacing: '-1.5px', lineHeight: 1 }}>
                            {exceeded ? '+' : ''}{Math.abs(Math.round(remaining))}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>kcal</p>
                    </div>
                </div>

                {/* Macros avec cercles */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '18px', padding: '18px', marginBottom: '16px', border: '0.5px solid var(--border-color)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Valeurs nutritionnelles</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        {macros.map(m => (
                            <div key={m.label} style={{ textAlign: 'center' }}>
                                <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: m.track, border: `3px solid ${m.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                                    <p style={{ color: m.color, fontSize: '16px', fontWeight: '800', lineHeight: 1 }}>{Math.round(m.value * 10) / 10}</p>
                                    <p style={{ color: m.color, fontSize: '10px', fontWeight: '600', opacity: 0.8 }}>g</p>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Health Score */}
                {data.healthScore !== null && tier !== 'free' && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '18px', padding: '16px 18px', marginBottom: '16px', border: `0.5px solid ${scoreColor}25` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>Score santé</p>
                            <div style={{ background: `${scoreColor}18`, borderRadius: '20px', padding: '3px 10px' }}>
                                <p style={{ color: scoreColor, fontSize: '14px', fontWeight: '800' }}>{data.healthScore.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)' }}>/10</span></p>
                            </div>
                        </div>
                        <div style={{ height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(data.healthScore / 10) * 100}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                style={{ height: '100%', background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}99)`, borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                )}

                {/* Conseil Coach Yao */}
                {data.coachMessage && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                            background: 'rgba(var(--accent-rgb), 0.08)', 
                            borderRadius: '20px', 
                            padding: '18px', 
                            marginBottom: '16px', 
                            border: '0.5px solid rgba(var(--accent-rgb), 0.2)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '12px', 
                                background: 'var(--accent)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: '18px',
                                boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)'
                            }}>
                                💡
                            </div>
                            <div>
                                <p style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                    Conseil Coach Yao
                                </p>
                                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', lineHeight: '1.5', margin: 0 }}>
                                    {data.coachMessage}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Bouton voir les détails */}
                {data.vitamins.length > 0 && tier !== 'free' && (
                    <button
                        onClick={() => setShowVitamins(true)}
                        style={{ width: '100%', padding: '15px 18px', borderRadius: '18px', background: 'transparent', border: '0.5px solid rgba(14,165,233,0.35)', color: '#0ea5e9', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}
                    >
                        <span>🔬 Voir les micro-nutriments {tier === 'pro' && '🔒'}</span>
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>

            {/* ── ACTIONS FIXES EN BAS ───────────────────────── */}
            <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '16px 20px', background: 'var(--bg-primary)', borderTop: '0.5px solid var(--border-color)', backdropFilter: 'blur(20px)', display: 'flex', gap: '10px', zIndex: 100 }}>
                <button
                    onClick={() => router.back()}
                    style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                >
                    ← Modifier
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ flex: 2, padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--accent), #10b981)', color: '#fff', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}
                >
                    {isSaving ? 'Ajout...' : '✅ Ajouter au journal'}
                </button>
            </div>

            {/* ── POPUP MICRO-NUTRIMENTS ─────────────────────── */}
            <AnimatePresence>
                {showVitamins && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowVitamins(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', width: '100%', maxWidth: '480px', background: 'var(--bg-secondary)', borderRadius: '28px 28px 0 0', border: '0.5px solid var(--border-color)', zIndex: 201, maxHeight: '80vh', overflowY: 'auto', paddingBottom: '40px' }}
                        >
                            {/* Handle */}
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px' }}>
                                <div style={{ width: '36px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }} />
                            </div>

                            <div style={{ padding: '8px 20px 20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '800', margin: 0 }}>Micro-nutriments</h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Estimations pour ce repas</p>
                                    </div>
                                    <button
                                        onClick={() => setShowVitamins(false)}
                                        style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-color)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {tier === 'pro' ? (
                                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>💎</div>
                                        <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Exclusivité Premium</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5', marginBottom: '24px', padding: '0 20px' }}>
                                            L'analyse détaillée des micro-nutriments (Vitamines, Minéraux) est réservée aux abonnés Premium.
                                        </p>
                                        <button 
                                            onClick={() => router.push('/upgrade')}
                                            style={{ background: 'linear-gradient(135deg, var(--accent), #10b981)', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '14px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(var(--accent-rgb), 0.3)' }}
                                        >
                                            Débloquer Premium
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            {data.vitamins.map((v, i) => {
                                                const pct = Math.min(v.percentage, 100)
                                                const barColor = pct >= 50 ? '#10b981' : pct >= 25 ? '#0ea5e9' : '#f59e0b'
                                                return (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.06 }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                                                            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>{v.name}</p>
                                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>{v.value}</p>
                                                                <p style={{ color: barColor, fontSize: '12px', fontWeight: '800' }}>{v.percentage}%</p>
                                                                <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>AJR</p>
                                                            </div>
                                                        </div>
                                                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.5, delay: 0.1 + i * 0.06 }}
                                                                style={{ height: '100%', background: `linear-gradient(90deg, ${barColor}, ${barColor}99)`, borderRadius: '3px' }}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '24px', lineHeight: '1.5' }}>
                                            Valeurs estimées par l'IA. Elles peuvent varier selon la préparation et les ingrédients exacts.
                                        </p>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
