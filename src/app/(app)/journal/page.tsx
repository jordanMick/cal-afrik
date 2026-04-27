'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore, getMealSlot, type MealSlotKey } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { calculateCalorieTarget, getStreakIcon } from '@/lib/nutrition'
import { checkPermission } from '@/lib/subscription'
import type { Meal } from '@/types'
import { ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

const toLocalDateString = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const getLast7Days = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return toLocalDateString(d) }).reverse()
const today = () => toLocalDateString()
const formatDay = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const MEAL_TYPE_EMOJIS: Record<string, string> = { petit_dejeuner: '🌅', dejeuner: '☀️', diner: '🌙', collation: '🥜' }

const ACCENT_COLOR = 'var(--accent)'
const GRADIENT = 'linear-gradient(90deg, var(--accent), var(--success))'
const GOAL_LABELS: Record<string, string> = { perdre: 'Perdre du poids', maintenir: 'Maintenir le poids', prendre: 'Prendre du poids' }

function WeightChart({ entries, profile, selectedPeriod, setSelectedPeriod }: { entries: { date: string; weight: number }[], profile: any, selectedPeriod: string, setSelectedPeriod: (p: string) => void }) {
    const isPremium = profile?.subscription_tier === 'premium'
    const isPro = profile?.subscription_tier === 'pro' || isPremium

    // Vue hebdomadaire : dernière pesée de chaque semaine sur N semaines
    const getWeeklyData = (weeksCount: number) => {
        const result: { label: string; weight: number; date: string }[] = []
        const now = new Date()
        for (let i = weeksCount - 1; i >= 0; i--) {
            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() - i * 7 - 6)
            const weekEnd = new Date(now)
            weekEnd.setDate(now.getDate() - i * 7)
            const startStr = weekStart.toISOString().split('T')[0]
            const endStr = weekEnd.toISOString().split('T')[0]
            const weekEntries = entries.filter(e => {
                const d = e.date.split('T')[0]
                return d >= startStr && d <= endStr
            })
            const label = `S${weeksCount - i}`
            if (weekEntries.length > 0) {
                result.push({ label, weight: weekEntries[weekEntries.length - 1].weight, date: startStr })
            }
        }
        return result
    }

    // Vue mensuelle : dernière pesée par mois
    const getMonthlyData = (monthsCount: number) => {
        const result: { label: string; weight: number; date: string }[] = []
        const now = new Date()
        for (let i = monthsCount - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const monthKey = d.toISOString().slice(0, 7)
            const label = d.toLocaleDateString('fr-FR', { month: 'short' }).charAt(0).toUpperCase() + d.toLocaleDateString('fr-FR', { month: 'short' }).slice(1)
            const monthEntries = entries.filter(e => e.date.startsWith(monthKey))
            if (monthEntries.length > 0) {
                result.push({ label, weight: monthEntries[monthEntries.length - 1].weight, date: monthKey })
            }
        }
        return result
    }

    // Vue quotidienne : dernière pesée par jour
    const getDailyData = (daysCount: number) => {
        const result: { label: string; weight: number; date: string }[] = []
        const now = new Date()
        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(now.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const label = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
            const dayEntries = entries.filter(e => e.date.startsWith(dateStr))
            if (dayEntries.length > 0) {
                result.push({ label, weight: dayEntries[dayEntries.length - 1].weight, date: dateStr })
            } else if (result.length > 0) {
                // Pour éviter les trous dans le graphe, on peut optionnellement répéter le dernier poids
                // Mais ici on préfère ne rien afficher s'il n'y a pas de pesée ce jour-là pour la courbe.
            }
        }
        return result
    }

    const chartData = selectedPeriod === '7d' ? getDailyData(7)
        : selectedPeriod === '8w' ? getWeeklyData(8)
            : selectedPeriod === '6m' ? getMonthlyData(6)
                : getMonthlyData(12)

    // 2. Calcul du message de progression
    const getProgressionInfo = () => {
        if (chartData.length < 2) return null
        const first = chartData[0].weight
        const last = chartData[chartData.length - 1].weight
        const diff = Math.round((last - first) * 10) / 10
        const goal = profile?.goal || 'maintenir'

        let isPositive = false
        let message = ""

        if (goal === 'perdre') {
            isPositive = diff < 0
            message = isPositive
                ? `Super ! Tu as perdu ${Math.abs(diff)}kg sur cette période. Continue comme ça ! 🔥`
                : (diff === 0 ? "Ton poids est stable. Reste vigilant sur tes portions pour relancer la perte. 💪" : `Ton poids a augmenté de ${diff}kg. Yao te conseille de bouger un peu plus cette semaine. ⚠️`)
        } else if (goal === 'prendre') {
            isPositive = diff > 0
            message = isPositive
                ? `Excellent ! +${diff}kg de masse. Tes muscles te remercient ! 💪`
                : (diff === 0 ? "Stabilité parfaite. Pour prendre du muscle, essaie d'augmenter tes protéines. 🥩" : `Oups, -${Math.abs(diff)}kg. N'oublie pas de manger suffisamment ! 🍽️`)
        } else {
            isPositive = Math.abs(diff) <= 0.5
            message = isPositive
                ? "Maintien parfait ! Ton équilibre actuel est idéal. 🎯"
                : `Léger écart de ${Math.abs(diff)}kg. Reviens doucement vers ton poids de forme. ⚖️`
        }

        return { message, isPositive }
    }

    const prog = getProgressionInfo()

    const W = 320, H = 140, padX = 30, padY = 20
    const weights = chartData.map(e => e.weight)
    const minW = chartData.length > 1 ? Math.min(...weights) - 2 : (weights[0] || 70) - 5
    const maxW = chartData.length > 1 ? Math.max(...weights) + 2 : (weights[0] || 70) + 5
    const range = maxW - minW || 1
    const toX = (i: number) => padX + (i / Math.max(chartData.length - 1, 1)) * (W - padX - 15)
    const toY = (w: number) => padY + ((maxW - w) / range) * (H - padY * 2.5)
    const points = chartData.map((e, i) => ({ x: toX(i), y: toY(e.weight), ...e }))
    const path = points.length > 1 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : ''

    return (
        <div style={{ padding: '8px 0' }}>
            {/* Sélecteur de période */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Période</p>
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px', border: '0.5px solid var(--border-color)' }}>
                    {[
                        { id: '7d', label: '7 j', locked: false },
                        { id: '8w', label: '8 sem', locked: false },
                        { id: '6m', label: '6 mois', locked: !isPremium },
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => p.locked ? null : setSelectedPeriod(p.id)}
                            style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                fontSize: '9px',
                                fontWeight: '700',
                                background: selectedPeriod === p.id ? 'var(--bg-tertiary)' : 'transparent',
                                color: p.locked ? 'var(--text-muted)' : selectedPeriod === p.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: p.locked ? 'not-allowed' : 'pointer',
                                position: 'relative' as const,
                            }}
                        >
                            {p.label}{p.locked ? ' 🔒' : ''}
                        </button>
                    ))}
                </div>
            </div>

            {/* Graphique */}
            {chartData.length > 0 ? (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '140px', display: 'block' }}>
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--bg-primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grille horizontale (Lignes de repère) */}
                    {[0, 0.5, 1].map((t, i) => {
                        const y = padY + t * (H - padY * 2.5)
                        const val = Math.round(maxW - t * range)
                        return (
                            <g key={i}>
                                <line x1={padX} y1={y} x2={W - 8} y2={y} stroke="var(--border-color)" strokeWidth="1" strokeOpacity="0.5" />
                                <text x={padX - 6} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8" fontWeight="600">{val}</text>
                            </g>
                        )
                    })}

                    {/* Aire sous la courbe */}
                    {path && points.length > 1 && (
                        <path
                            d={`${path} L ${points[points.length - 1].x.toFixed(1)} ${H - padY * 1.5} L ${points[0].x.toFixed(1)} ${H - padY * 1.5} Z`}
                            fill="url(#areaGrad)"
                        />
                    )}

                    {/* Courbe */}
                    {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                    {/* Points + labels mois */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r="3.5" fill="var(--accent)" stroke="var(--bg-primary)" strokeWidth="2" />
                            {i === points.length - 1 && (
                                <g>
                                    <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="800">{p.weight}k</text>
                                </g>
                            )}
                            <text x={p.x} y={H - 5} textAnchor="middle" fill={i === points.length - 1 ? 'var(--accent)' : 'var(--text-muted)'} fontSize="8" fontWeight="700">{p.label}</text>
                        </g>
                    ))}

                    {/* Si un seul point */}
                    {points.length === 1 && (
                        <circle cx={points[0].x} cy={points[0].y} r="4" fill="var(--accent)" stroke="var(--bg-primary)" strokeWidth="2" />
                    )}
                </svg>
            ) : (
                <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '12px' }}>
                    Pas assez de données pour cette période
                </div>
            )}

            {/* Message de Yao */}
            {prog && (
                <div style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: prog.isPositive ? 'rgba(var(--success-rgb), 0.08)' : 'rgba(var(--danger-rgb), 0.08)',
                    border: `0.5px solid ${prog.isPositive ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--danger-rgb), 0.2)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                }}>
                    <span style={{ fontSize: '18px' }}>{prog.isPositive ? '✨' : '💡'}</span>
                    <p style={{ color: prog.isPositive ? 'var(--success)' : 'var(--danger)', fontSize: '12px', lineHeight: '1.5', fontWeight: '500' }}>
                        {prog.message}
                    </p>
                </div>
            )}
        </div>
    )
}

function WeightModal({ currentWeight, onClose, onSave }: { currentWeight: number; onClose: () => void; onSave: (w: number) => Promise<void> }) {
    const [value, setValue] = useState(currentWeight.toString())
    const [saving, setSaving] = useState(false)
    const handleSave = async () => { const num = parseFloat(value); if (isNaN(num) || num < 20 || num > 300) return; setSaving(true); await onSave(num); setSaving(false); onClose() }
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.6)', backdropFilter: 'blur(10px)', zIndex: 1000 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', maxWidth: '480px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0', border: '0.5px solid var(--border-color)', zIndex: 1010, padding: '24px 20px 60px', boxShadow: '0 -10px 40px rgba(var(--bg-primary-rgb),0.2)' }}>
                <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', paddingTop: '10px' }}><div style={{ width: '36px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }} /></div>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', marginBottom: '4px' }}>Consigner mon poids</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Poids actuel : {currentWeight} kg</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <input type="number" value={value} onChange={e => setValue(e.target.value)} step="0.1" style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', textAlign: 'center' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>kg</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: '12px', background: saving ? 'var(--bg-tertiary)' : GRADIENT, border: 'none', color: saving ? 'var(--text-muted)' : '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>{saving ? 'Enregistrement...' : '✅ Enregistrer'}</button>
                </div>
            </div>
        </>
    )
}

function MealDetailPanel({ meal, onClose, onDelete, onImageUpdate }: { meal: Meal; onClose: () => void; onDelete: (id: string) => Promise<void>; onImageUpdate?: (id: string, url: string) => void }) {
    const [showCoach, setShowCoach] = useState(true)
    const [imageUploading, setImageUploading] = useState(false)
    const [localImageUrl, setLocalImageUrl] = useState(meal.image_url)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handlePhotoChange = async (file: File) => {
        if (!file) return
        setImageUploading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const ext = file.name.split('.').pop() || 'jpg'
            const fileName = `${session.user.id}/${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage.from('meal-images').upload(fileName, file, { upsert: true })
            if (upErr) throw upErr
            const { data: { publicUrl } } = supabase.storage.from('meal-images').getPublicUrl(fileName)
            const res = await fetch('/api/meals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ id: meal.id, image_url: publicUrl })
            })
            const json = await res.json()
            if (json.success) {
                setLocalImageUrl(publicUrl)
                onImageUpdate?.(meal.id, publicUrl)
            }
        } catch (err) {
            console.error('Photo upload error:', err)
        } finally {
            setImageUploading(false)
        }
    }
    const totalKcal = (meal.protein_g * 4) + (meal.carbs_g * 4) + (meal.fat_g * 9)
    const macros = totalKcal === 0 ? { protein: 0, carbs: 0, fat: 0 } : { protein: Math.round((meal.protein_g * 4 / totalKcal) * 100), carbs: Math.round((meal.carbs_g * 4 / totalKcal) * 100), fat: Math.round((meal.fat_g * 9 / totalKcal) * 100) }
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.6)', backdropFilter: 'blur(10px)', zIndex: 1000 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', maxWidth: '480px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0', border: '0.5px solid var(--border-color)', zIndex: 1010, maxHeight: '90vh', overflowY: 'auto', paddingBottom: '100px', boxShadow: '0 -10px 40px rgba(var(--bg-primary-rgb), 0.2)' }}>
                <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: 'linear-gradient(90deg, var(--accent), var(--success), var(--warning))' }} />
                <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}><div style={{ width: '36px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }} /></div>
                <div style={{ width: '100%', height: '160px', overflow: 'hidden', position: 'relative', background: 'var(--bg-tertiary)', display: localImageUrl ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {localImageUrl
                        ? <img src={localImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '48px' }}>🍽️</span>
                    }
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoChange(f) }} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageUploading}
                        style={{ position: 'absolute', bottom: '10px', right: '10px', padding: '7px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {imageUploading ? '⏳' : '📷'} {imageUploading ? 'Envoi...' : 'Changer'}
                    </button>
                </div>
                <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', flex: 1, marginRight: '12px' }}>{meal.custom_name || 'Repas'}</h2>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{formatTime(meal.logged_at)}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '14px' }}>{MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'} · {meal.portion_g}g</p>
                    <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '12px', border: '0.5px solid rgba(var(--accent-rgb), 0.2)' }}>
                        <p style={{ color: 'var(--accent)', fontSize: '44px', fontWeight: '700', letterSpacing: '-2px' }}>{Math.round(meal.calories)}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>kilocalories</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                        {[
                            { label: 'Protéines', value: meal.protein_g, color: 'var(--success)', bg: 'rgba(var(--success-rgb), 0.1)' },
                            { label: 'Glucides', value: meal.carbs_g, color: 'var(--accent)', bg: 'rgba(var(--accent-rgb), 0.1)' },
                            { label: 'Lipides', value: meal.fat_g, color: 'var(--warning)', bg: 'rgba(var(--warning-rgb), 0.1)' }
                        ].map(m => (
                            <div key={m.label} style={{ background: m.bg, borderRadius: '14px', padding: '12px 8px', textAlign: 'center', border: `0.5px solid ${m.color}20` }}>
                                <p style={{ color: m.color, fontSize: '16px', fontWeight: '800' }}>{Math.round(m.value)}g</p>
                                <p style={{ color: m.color, opacity: 0.8, fontSize: '9px', marginTop: '2px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                    {meal.health_score !== undefined && meal.health_score !== null && (
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '14px', marginBottom: '16px', border: '0.5px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>Score santé</p>
                                <p style={{ color: meal.health_score >= 7 ? '#10b981' : meal.health_score >= 5 ? '#f59e0b' : '#ef4444', fontSize: '14px', fontWeight: '800' }}>{meal.health_score.toFixed(1)} /10</p>
                            </div>
                            {meal.vitamins && meal.vitamins.length > 0 && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--border-color)' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>Micro-nutriments clés :</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {meal.vitamins.map((v, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{v.name}</p>
                                                <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600' }}>{v.value} <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '800', marginLeft: '4px' }}>{v.percentage}%</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {meal.coach_message && (
                        <div style={{ marginBottom: '14px' }}>
                            <button onClick={() => setShowCoach(!showCoach)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'transparent', border: '0.5px solid rgba(var(--warning-rgb), 0.3)', color: 'var(--warning)', fontWeight: '500', fontSize: '13px', cursor: 'pointer', textAlign: 'left', marginBottom: showCoach ? '8px' : '0' }}>
                                {showCoach ? '💡 Conseil du coach' : '💡 Voir le conseil du coach →'}
                            </button>
                            {showCoach && (
                                <div style={{ background: 'rgba(var(--warning-rgb), 0.06)', borderRadius: '10px', padding: '12px', border: '0.5px solid rgba(var(--warning-rgb), 0.2)' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6' }}>
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                                                strong: ({ children }) => <strong style={{ color: 'var(--warning)', fontWeight: 700 }}>{children}</strong>,
                                                em: ({ children }) => <em style={{ color: 'var(--accent)' }}>{children}</em>,
                                            }}
                                        >
                                            {meal.coach_message}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}>← Retour</button>
                        <button onClick={async () => { if (confirm('Supprimer ce repas ?')) { await onDelete(meal.id); onClose() } }} style={{ flex: 1, padding: '13px', borderRadius: '12px', background: 'transparent', border: '0.5px solid var(--danger)', color: 'var(--danger)', fontWeight: '500', fontSize: '13px', cursor: 'pointer', opacity: 0.8 }}>🗑️ Supprimer</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default function RapportPage() {
    const router = useRouter()
    const { profile, setProfile } = useAppStore()
    const [meals7days, setMeals7days] = useState<Meal[]>([])
    const [weightEntries, setWeightEntries] = useState<{ date: string; weight: number }[]>([])
    const [showWeightModal, setShowWeightModal] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
    const [selectedPeriod, setSelectedPeriod] = useState('7d')
    const [isLoading, setIsLoading] = useState(true)
    const [targetUpdate, setTargetUpdate] = useState<{ old: number, new: number, isLocked: boolean } | null>(null)

    const last7 = getLast7Days()
    const todayStr = today()

    useEffect(() => { fetchAll() }, [])

    const fetchAll = async () => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            // 1. Récupérer les repas (existant)
            const tzOffset = new Date().getTimezoneOffset()
            const resMeals = await fetch(`/api/meals?date_from=${last7[0]}&date_to=${todayStr}&tz_offset_min=${tzOffset}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
            const jsonMeals = await resMeals.json()
            if (jsonMeals.success) setMeals7days(jsonMeals.data)

            // 2. Récupérer l'historique de poids depuis la nouvelle table weight_logs
            const resWeight = await fetch('/api/user/weight_logs', { headers: { Authorization: `Bearer ${session.access_token}` } })
            const jsonWeight = await resWeight.json()
            if (jsonWeight.success && jsonWeight.data.length > 0) {
                // On garde l'horodatage complet pour distinguer plusieurs pesées le même jour
                const history = jsonWeight.data.map((log: any) => ({
                    date: log.logged_at,
                    weight: parseFloat(log.weight_kg)
                }))
                setWeightEntries(history)
            } else if (profile?.weight_kg) {
                // Fallback si l'historique est vide
                const lastDate = localStorage.getItem('lastWeightDate') || todayStr
                setWeightEntries([{ date: lastDate, weight: profile.weight_kg }])
            }
        } catch (err) { console.error(err) }
        finally { setIsLoading(false) }
    }

    const handleDeleteMeal = async (mealId: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
        setMeals7days(prev => prev.filter(m => m.id !== mealId))
    }

    const handleSaveWeight = async (newWeight: number) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !profile) return
        try {
            // Calculer les nouveaux objectifs nutritionnels
            const newTargets = calculateCalorieTarget({
                age: profile.age,
                gender: profile.gender === 'autre' ? 'homme' : profile.gender,
                weight_kg: newWeight,
                height_cm: profile.height_cm,
                activity_level: profile.activity_level,
                goal: profile.goal || 'maintenir'
            })

            const hasChanged = Math.abs(newWeight - (profile.weight_kg || 0)) > 0.1
            const oldTarget = profile.calorie_target
            const canAutoRecalculate = checkPermission(profile, 'hasAutomaticRecalculation')

            // 1. Mettre à jour le profil (poids, et objectifs si autorisé)
            const updateBody: any = { weight_kg: newWeight }
            if (canAutoRecalculate) {
                Object.assign(updateBody, newTargets)
            }

            const resProfile = await fetch('/api/user/weight', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify(updateBody)
            })
            const jsonProfile = await resProfile.json()

            // 2. Ajouter l'entrée dans l'historique
            const resLog = await fetch('/api/user/weight_logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ weight_kg: newWeight })
            })
            const jsonLog = await resLog.json()

            if (!jsonProfile.success || !jsonLog.success) return

            // Mise à jour locale du profile (si pas Pro, on ne change que le poids)
            if (canAutoRecalculate) {
                setProfile({ ...profile, weight_kg: newWeight, ...newTargets })
            } else {
                setProfile({ ...profile, weight_kg: newWeight })
            }

            localStorage.setItem('lastWeightDate', todayStr)

            // Notification : On affiche toujours le changement pour "l'effet wow", 
            // mais on précise si c'est bloqué ou appliqué.
            if (hasChanged && oldTarget !== newTargets.calorie_target) {
                setTargetUpdate({
                    old: oldTarget,
                    new: newTargets.calorie_target,
                    isLocked: !canAutoRecalculate
                })
                setTimeout(() => setTargetUpdate(null), 6000)
            }

            // Mettre à jour l'état local pour le graphique immédiatement
            const newEntry = { date: new Date().toISOString(), weight: newWeight }
            setWeightEntries(prev => [...prev, newEntry].sort((a, b) => a.date.localeCompare(b.date)))
        } catch (err) { console.error(err) }
    }

    const totalMeals = meals7days.length
    const totalCalories7 = meals7days.reduce((acc, m) => acc + m.calories, 0)
    const avgCaloriesPerDay = totalMeals > 0 ? Math.round(totalCalories7 / 7) : 0

    const mealsByDay: Record<string, Meal[]> = {}
    for (const meal of meals7days) { const d = meal.logged_at.split('T')[0]; if (!mealsByDay[d]) mealsByDay[d] = []; mealsByDay[d].push(meal) }

    const todayMeals = mealsByDay[todayStr] || []
    const todayCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0)

    const calculatedStreak = (() => {
        let streak = 0;
        let startIndex = last7.length - 1;
        if ((mealsByDay[last7[startIndex]] || []).length === 0) startIndex--;
        for (let i = startIndex; i >= 0; i--) {
            if ((mealsByDay[last7[i]] || []).length > 0) streak++;
            else break;
        }
        return Math.max(0, streak);
    })()

    const currentWeight = profile?.weight_kg ?? 0
    const weightMin = weightEntries.length > 0 ? Math.min(...weightEntries.map(e => e.weight)) : currentWeight
    const weightMax = weightEntries.length > 0 ? Math.max(...weightEntries.map(e => e.weight)) : currentWeight

    const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '24px', padding: '24px', marginBottom: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: '52px 20px 24px' }}>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>Rapport</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>Tes analyses nutritionnelles</p>
            </div>

            <div style={{ padding: '0 20px 24px' }}>
                {/* CARTE ACCÈS MENUS COACH YAO (Déplacé depuis Dashboard) */}
                <div
                    onClick={() => router.push('/menus')}
                    style={{
                        background: 'rgba(var(--bg-secondary-rgb), 0.5)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '24px',
                        padding: '18px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(var(--success-rgb), 0.25)' }}>
                            <img src="/logo.png" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '800' }}>Mon Planning & Menus</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '500' }}>Suggestions personnalisées Yao</p>
                        </div>
                    </div>
                    <div style={{ color: 'var(--accent)', opacity: 0.8 }}>
                        <ChevronRight size={20} />
                    </div>
                </div>
            </div>

            <div style={{ padding: '18px 20px' }}>

                {/* 7 JOURS */}
                <div style={card}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--accent), var(--success), var(--warning), #ec4899)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>7 derniers jours</p>
                        <span style={{ color: 'var(--accent)', fontSize: '11px', background: 'rgba(var(--accent-rgb), 0.1)', padding: '3px 10px', borderRadius: '20px', border: '0.5px solid rgba(var(--accent-rgb), 0.3)' }}>📸 {totalMeals} repas</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '14px', border: '0.5px solid rgba(var(--accent-rgb), 0.15)' }}>
                            <p style={{ color: 'var(--accent)', fontSize: '26px', fontWeight: '700', letterSpacing: '-1px' }}>{Math.round(totalCalories7).toLocaleString()}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>kcal totales</p>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '14px', border: '0.5px solid rgba(var(--success-rgb), 0.15)' }}>
                            <p style={{ color: 'var(--success)', fontSize: '26px', fontWeight: '700', letterSpacing: '-1px' }}>{avgCaloriesPerDay}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>kcal/jour moy.</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        {[
                            { label: 'Prot. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.protein_g, 0) / 7) : 0, color: 'var(--success)' },
                            { label: 'Gluc. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.carbs_g, 0) / 7) : 0, color: 'var(--accent)' },
                            { label: 'Lip. moy.', value: totalMeals > 0 ? Math.round(meals7days.reduce((a, m) => a + m.fat_g, 0) / 7) : 0, color: 'var(--warning)' },
                        ].map(m => (
                            <div key={m.label} style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: `0.5px solid ${m.color}15` }}>
                                <p style={{ color: m.color, fontSize: '16px', fontWeight: '600' }}>{m.value}g</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>{m.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* HISTORIQUE 7 JOURS */}
                <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600' }}>Historique</p>
                        <button onClick={() => router.push('/historique')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer' }}>Tous →</button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', marginBottom: '18px' }}>
                        {last7.map((date, idx) => {
                            const dayMeals = mealsByDay[date] || []
                            const hasEaten = dayMeals.length > 0
                            const isToday = date === todayStr
                            return (
                                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700' }}>{formatDay(date)}</span>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: isToday ? 'var(--accent)' : hasEaten ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--bg-tertiary)',
                                        border: isToday ? 'none' : hasEaten ? `1.5px solid var(--accent)` : '0.5px solid var(--border-color)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {hasEaten ? <span style={{ color: isToday ? '#fff' : 'var(--accent)', fontSize: '14px', fontWeight: '900' }}>✓</span> : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(date).getDate()}</span>}
                                    </div>
                                    <span style={{ color: hasEaten ? 'var(--accent)' : 'var(--text-muted)', fontSize: '9px', fontWeight: '800' }}>{hasEaten ? `${dayMeals.length}` : ''}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '14px', borderTop: '0.5px solid var(--border-color)' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Jours consécutifs</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>{getStreakIcon(calculatedStreak)}</span>
                                <span style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '700' }}>
                                    {calculatedStreak}
                                </span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Aujourd'hui</p>
                            <p style={{ color: 'var(--success)', fontSize: '22px', fontWeight: '700' }}>{Math.round(todayCalories)} <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '400' }}>kcal</span></p>
                        </div>
                    </div>
                </div>

                {/* REPAS D'AUJOURD'HUI (LISTE PLATE DES PLATS SCANNÉS) */}
                {todayMeals.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Plats du jour</p>
                            <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.1)', padding: '2px 8px', borderRadius: '10px' }}>{todayMeals.length} scannés</span>
                        </div>
                        {todayMeals.map((meal, idx) => {
                            return (
                                <div key={meal.id} onClick={() => setSelectedMeal(meal)} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '24px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', marginBottom: '12px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-tertiary)', flexShrink: 0 }}>
                                        {meal.image_url ? <img src={meal.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{MEAL_TYPE_EMOJIS[meal.meal_type] || '🍽️'}</div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{meal.custom_name || 'Repas sans nom'}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{formatTime(meal.logged_at)} · {Math.round(meal.portion_g)}g</p>
                                            {meal.coach_message && (
                                                <span style={{ color: 'var(--warning)', fontSize: '10px', fontWeight: '700', background: 'rgba(var(--warning-rgb), 0.1)', padding: '2px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    💡 Voir conseil coach
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '800' }}>{Math.round(meal.calories)}<span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>kcal</span></p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* POIDS */}
                <div style={card}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #2563eb, #ec4899)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600' }}>Poids</p>
                        <button onClick={() => setShowWeightModal(true)} style={{ padding: '7px 16px', borderRadius: '20px', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>+ Ajouter</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: '12px', padding: '14px', border: '0.5px solid rgba(var(--accent-rgb), 0.2)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}>Actuel</p>
                            <p style={{ color: 'var(--accent)', fontSize: '24px', fontWeight: '700' }}>{currentWeight} <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>kg</span></p>
                        </div>
                        <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: '12px', padding: '14px', border: '0.5px solid var(--border-color)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>Le plus lourd</p>
                            <p style={{ color: 'var(--danger)', fontSize: '15px', fontWeight: '600' }}>{weightMax} kg</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '6px' }}>Le plus léger</p>
                            <p style={{ color: 'var(--success)', fontSize: '15px', fontWeight: '600' }}>{weightMin} kg</p>
                        </div>
                    </div>
                    {/* Objectif de poids */}
                    {profile?.goal_weight_kg && profile.goal !== 'maintenir' && (() => {
                        const initialWeight = weightMax  // Le plus haut = poids de départ
                        const current = currentWeight
                        const target = profile.goal_weight_kg
                        const totalToLose = Math.abs(initialWeight - target)
                        const progressMade = Math.abs(initialWeight - current)
                        const pct = totalToLose > 0 ? Math.min(100, Math.round((progressMade / totalToLose) * 100)) : 0
                        const remaining = Math.round(Math.abs(current - target) * 10) / 10
                        const isDone = progressMade > 0 && ((profile.goal === 'perdre' && current <= target) || (profile.goal === 'prendre' && current >= target))
                        const barColor = isDone ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--warning)'
                        return (
                            <div style={{ marginBottom: '16px', background: 'var(--bg-tertiary)', borderRadius: '16px', padding: '16px', border: `0.5px solid ${barColor}25` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Progression vers l'objectif</p>
                                        <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', marginTop: '2px' }}>
                                            {isDone ? '🎉 Objectif atteint !' : profile.goal === 'perdre' ? `Encore ${remaining} kg à perdre` : `Encore ${remaining} kg à prendre`}
                                        </p>
                                        {isDone && (
                                            <p style={{ color: 'var(--success)', fontSize: '11px', marginTop: '6px', lineHeight: '1.4', fontWeight: '500' }}>
                                                Félicitations ! 🥳 Va dans tes paramètres de profil pour changer ton objectif en "Maintenir le poids".
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ color: barColor, fontSize: '24px', fontWeight: '900', letterSpacing: '-1px' }}>{pct}<span style={{ fontSize: '12px' }}>%</span></p>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{target} kg visé</p>
                                    </div>
                                </div>
                                {/* Barre de progression */}
                                <div style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${pct}%`,
                                        background: isDone ? 'var(--success)' : `linear-gradient(90deg, var(--warning), ${barColor})`,
                                        borderRadius: '4px',
                                        transition: 'width 0.8s ease'
                                    }} />
                                </div>
                                {/* Jalons */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{initialWeight} kg</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '9px' }}>Départ → Cible : {target} kg</p>
                                </div>
                            </div>
                        )
                    })()}

                    {weightEntries.length > 0 ? (
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '24px', padding: '16px', border: '0.5px solid var(--border-color)' }}>
                            {/* GRAPHIQUE OU PAYWALL */}
                            {checkPermission(profile, 'hasGraph') ? (
                                <WeightChart
                                    entries={weightEntries}
                                    profile={profile}
                                    selectedPeriod={selectedPeriod}
                                    setSelectedPeriod={setSelectedPeriod}
                                />
                            ) : (
                                <div
                                    onClick={() => router.push('/upgrade')}
                                    style={{
                                        margin: '0 20px 20px',
                                        height: '140px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '24px',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}>
                                    <span style={{ fontSize: '24px' }}>📈</span>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>Activez le graphique avec le plan Pro</p>
                                    <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 'bold' }}>DÉCOUVRIR →</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Aucune donnée de poids</p>
                        </div>
                    )}
                    {profile && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '0.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-around' }}>
                            {[
                                { label: 'Taille', value: profile.height_cm ? `${profile.height_cm} cm` : '—' },
                                { label: 'Objectif kcal', value: profile.calorie_target ? `${profile.calorie_target}` : '—' },
                                { label: 'But', value: profile.goal || '—' },
                            ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>{item.label}</p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showWeightModal && <WeightModal currentWeight={currentWeight} onClose={() => setShowWeightModal(false)} onSave={handleSaveWeight} />}
            {selectedMeal && <MealDetailPanel meal={selectedMeal} onClose={() => setSelectedMeal(null)} onDelete={handleDeleteMeal} onImageUpdate={(id, url) => setMeals7days(prev => prev.map(m => m.id === id ? { ...m, image_url: url } : m))} />}

            {/* Notification de mise à jour des objectifs */}
            {targetUpdate && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    right: '20px',
                    background: 'rgba(var(--success-rgb), 0.95)',
                    color: '#fff',
                    padding: '16px',
                    borderRadius: '16px',
                    zIndex: 100,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(8px)',
                    border: '0.5px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'slideIn 0.4s ease'
                }}>
                    <style>{`
                        @keyframes slideIn {
                            from { transform: translateY(-100%); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                    `}</style>
                    <div style={{ fontSize: '24px' }}>⚡</div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '700', fontSize: '14px' }}>
                            {targetUpdate.isLocked ? "💡 Fonction Pro" : "Objectifs mis à jour !"}
                        </p>
                        <p style={{ fontSize: '12px', opacity: 0.9 }}>
                            {targetUpdate.isLocked
                                ? `Votre nouvelle cible serait de ${targetUpdate.new} kcal. Passez Pro pour l'activer.`
                                : `Suite à votre pesée, votre cible passe de ${targetUpdate.old} à ${targetUpdate.new} kcal.`}
                        </p>
                        {targetUpdate.isLocked && (
                            <button
                                onClick={() => router.push('/upgrade')}
                                style={{
                                    marginTop: '8px',
                                    padding: '6px 12px',
                                    background: '#fff',
                                    color: 'var(--success)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}>
                                DEVENIR PRO →
                            </button>
                        )}
                    </div>
                    <button onClick={() => setTargetUpdate(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>×</button>
                </div>
            )}
        </div>
    )
}
