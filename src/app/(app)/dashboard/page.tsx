'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore, getMealSlot, type MealSlotKey } from '@/store/useAppStore'
import { getProgressPercent } from '@/lib/nutrition'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getEffectiveTier } from '@/lib/subscription'
import PlannerCard from '@/components/dashboard/PlannerCard'

function WeeklyProgressChart({ targetKcal, tier }: { targetKcal: number, tier: string }) {
    const router = useRouter()
    const [weeklyData, setWeeklyData] = useState<{ date: string, calories: number }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchWeekly = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                const today = new Date()
                const sevenDaysAgo = new Date(today)
                sevenDaysAgo.setDate(today.getDate() - 6)

                const dateFrom = sevenDaysAgo.toISOString().split('T')[0]
                const dateTo = today.toISOString().split('T')[0]

                const res = await fetch(`/api/meals?date_from=${dateFrom}&date_to=${dateTo}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
                const json = await res.json()
                if (json.success) {
                    const meals = json.data as { logged_at: string, calories: number }[]
                    const dailyTotals: Record<string, number> = {}

                    // Initialisation des 7 derniers jours à zéro
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date(today)
                        d.setDate(today.getDate() - i)
                        dailyTotals[d.toISOString().split('T')[0]] = 0
                    }

                    // Somme des calories
                    meals.forEach(m => {
                        const dateStr = m.logged_at.split('T')[0]
                        if (dailyTotals[dateStr] !== undefined) {
                            dailyTotals[dateStr] += m.calories
                        }
                    })

                    const chartData = Object.entries(dailyTotals).map(([date, cals]) => ({ date, calories: cals }))
                    setWeeklyData(chartData)
                }
            } catch (err) { console.error(err) }
            finally { setLoading(false) }
        }
        fetchWeekly()
    }, [])

    if (loading) return (
        <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '20px', padding: '20px', marginBottom: '28px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
            Chargement des analyses...
        </div>
    );

    const maxCal = Math.max(targetKcal, ...weeklyData.map(d => d.calories), Math.min(targetKcal + 500, 3000))
    const isLocked = tier === 'free'

    return (
        <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '20px', padding: '20px', marginBottom: '28px', position: 'relative', overflow: 'hidden' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '3px', height: '14px', background: 'linear-gradient(#f59e0b, #ec4899)', borderRadius: '2px' }} />
                7 derniers jours
            </h2>

            <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', gap: '8px',
                filter: isLocked ? 'blur(4px)' : 'none', transition: 'filter 0.3s'
            }}>
                {weeklyData.map((day) => {
                    const pct = Math.min(100, (day.calories / maxCal) * 100)
                    const isExceeded = day.calories > targetKcal
                    // On force une hauteur minimale de 4% pour signifier un jour sans relevé visuellement (ou on laisse vide)
                    const heightValue = day.calories > 0 ? Math.max(10, pct) : 0
                    const dateObj = new Date(day.date)
                    const dayLabel = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' }).charAt(0).toUpperCase()

                    return (
                        <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                            <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'flex-end', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', position: 'relative' }}>
                                {/* Barre de l'objectif sur le conteneur du fond */}
                                <div style={{ position: 'absolute', bottom: `${(targetKcal / maxCal) * 100}%`, left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />

                                <div style={{
                                    width: '100%',
                                    height: `${heightValue}%`,
                                    background: isExceeded ? 'linear-gradient(180deg, #ef4444, #f97316)' : 'linear-gradient(180deg, #6366f1, #10b981)',
                                    borderRadius: day.calories > 0 ? '6px' : '0',
                                    transition: 'height 1s ease-out',
                                    zIndex: 1,
                                    opacity: day.calories === 0 ? 0 : 1
                                }} />
                            </div>
                            <span style={{ color: day.date === new Date().toISOString().split('T')[0] ? '#fff' : '#555', fontSize: '11px', fontWeight: '600' }}>{dayLabel}</span>
                        </div>
                    )
                })}
            </div>

            {isLocked ? (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(10,10,10,0.6)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, padding: '20px', textAlign: 'center'
                }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '8px', border: '0.5px solid rgba(99,102,241,0.3)' }}>
                        🔒
                    </div>
                    <p style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Analyses Pro</p>
                    <p style={{ color: '#aaa', fontSize: '11px', marginBottom: '14px', maxWidth: '200px' }}>Débloquez le plan Pro pour suivre votre constance hebdomadaire.</p>
                    <button
                        onClick={() => router.push('/upgrade')}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', borderRadius: '8px',
                            color: '#fff', fontSize: '12px', fontWeight: '600', padding: '8px 16px', cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                        }}
                    >
                        Passer au Pro →
                    </button>
                </div>
            ) : (
                (() => {
                    const trackedDays = weeklyData.filter(d => d.calories > 0).length
                    const avg = weeklyData.reduce((acc, d) => acc + d.calories, 0) / (trackedDays || 1)
                    const diff = avg - targetKcal
                    const isGood = Math.abs(diff) < targetKcal * 0.1
                    
                    if (trackedDays === 0) return null

                    return (
                        <div style={{
                            marginTop: '20px',
                            padding: '12px 14px',
                            background: isGood ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                            border: `0.5px solid ${isGood ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px'
                        }}>
                             <span style={{ fontSize: '16px' }}>{isGood ? '🎯' : '📊'}</span>
                             <p style={{ color: isGood ? '#10b981' : '#f59e0b', fontSize: '11px', lineHeight: '1.5', fontWeight: '500' }}>
                                {isGood 
                                    ? `Excellente constance ! Ta moyenne de ${Math.round(avg)} kcal est pile dans ta cible. Continue comme ça !` 
                                    : `Analyse : Ta moyenne est de ${Math.round(avg)} kcal. ${diff > 0 ? "Tu es légèrement au-dessus de ta cible." : "Tu manges un peu moins que prévu."} Ajuste tes portions demain !`}
                             </p>
                        </div>
                    )
                })()
            )}
        </div>
    )
}

export default function DashboardPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const { profile, todayMeals, setTodayMeals, removeMeal, dailyCalories, dailyProtein, dailyCarbs, dailyFat } = useAppStore()

    const [isLoading, setIsLoading] = useState(true)
    // Mis à jour à chaque arrivée sur la page pour refléter l'heure réelle
    const [currentHour, setCurrentHour] = useState(new Date().getHours())

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65
    const remaining = Math.max(0, calorieTarget - dailyCalories)
    const exceeded = dailyCalories > calorieTarget

    const [isRenewing, setIsRenewing] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)

    const handleRenew = async () => {
        if (effectiveTier === 'free') return;
        setIsRenewing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ tier: effectiveTier })
            });

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Erreur de paiement');

            window.location.href = data.url;
        } catch (error: any) {
            alert(`Erreur: ${error.message}`);
        } finally {
            setIsRenewing(false);
        }
    }

    // Logique d'expiration
    const effectiveTier = getEffectiveTier(profile)
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
    const isExpiringSoon = effectiveTier !== 'free' && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0

    const radius = 40
    const circumference = 2 * Math.PI * radius
    const percent = getProgressPercent(dailyCalories, calorieTarget)
    const strokeDashoffset = circumference - (percent / 100) * circumference

    useEffect(() => {
        setCurrentHour(new Date().getHours())
    }, [])

    const getCoachMessage = () => {
        const hour = currentHour
        const pctDone = dailyCalories / calorieTarget

        if (exceeded) {
            const over = Math.round(dailyCalories - calorieTarget)
            return { emoji: '⚠️', text: `Tu as dépassé ton objectif de ${over} kcal. Essaie de rester léger pour le reste de la journée.` }
        }

        if (dailyCalories === 0) {
            if (hour >= 0 && hour < 5) return { emoji: '🌙', text: `C'est une nouvelle journée ! Repose-toi bien et pense à un bon petit-déjeuner ce matin.` }
            if (hour >= 5 && hour < 10) return { emoji: '🌅', text: `Bonne journée ! Commence par un bon petit-déjeuner pour bien démarrer.` }
            if (hour >= 10 && hour < 14) return { emoji: '☀️', text: `Il est l'heure de déjeuner ! Tu n'as encore rien mangé aujourd'hui.` }
            if (hour >= 14 && hour < 17) return { emoji: '🥜', text: `L'après-midi est bien entamé. Pense à manger quelque chose.` }
            if (hour >= 17 && hour < 23) return { emoji: '🌙', text: `Tu n'as rien mangé de la journée. Prends un bon dîner ce soir.` }
            return { emoji: '🌙', text: `Nouvelle journée qui commence. Pense à bien manger demain matin !` }
        }

        if (pctDone < 0.25) return { emoji: '💪', text: `Bon début ! Il te reste ${Math.round(remaining)} kcal. Continue à bien manger.` }
        if (pctDone < 0.60) {
            const remainingProtein = Math.max(0, proteinTarget - dailyProtein)
            if (remainingProtein > proteinTarget * 0.5)
                return { emoji: '🥩', text: `Pense aux protéines ! Il t'en manque encore ${Math.round(remainingProtein)}g.` }
            return { emoji: '✅', text: `Tu es sur la bonne voie. Il te reste ${Math.round(remaining)} kcal pour la journée.` }
        }
        if (pctDone < 0.90) {
            if (hour >= 17) return { emoji: '🌙', text: `Il te reste ${Math.round(remaining)} kcal pour le dîner. Reste équilibré !` }
            return { emoji: '👍', text: `Excellent suivi ! ${Math.round(remaining)} kcal restantes. Tu gères bien ta journée.` }
        }
        return { emoji: '🎯', text: `Presque au bout ! Il ne te reste que ${Math.round(remaining)} kcal. Un petit snack léger suffira.` }
    }

    const coachMsg = getCoachMessage()

    useEffect(() => { fetchMeals() }, [])

    const fetchMeals = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/meals?date=${today}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
            const json = await res.json()
            if (json.success) setTodayMeals(json.data)
        } catch (err) { console.error(err) }
        finally { setIsLoading(false) }
    }

    const handleDeleteMeal = async (mealId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
            const json = await res.json()
            // ✅ removeMeal au lieu de setTodayMeals pour déclencher markSlotNeedsRefresh
            if (json.success) removeMeal(mealId)
        } catch (err) { console.error(err) }
    }

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const macros = [
        { label: 'Protéines', val: dailyProtein, target: proteinTarget, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
        { label: 'Glucides', val: dailyCarbs, target: carbsTarget, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        { label: 'Lipides', val: dailyFat, target: fatTarget, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    ]

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '30px 20px 120px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
        }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '5px' }}>Cal Afrik</h1>
                    <p style={{ color: '#555', fontSize: '12px', fontWeight: '500' }}>👋 Hello {profile?.name?.split(' ')[0] || 'Ami'}!</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#141414', border: '0.5px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🔥</div>
                    <div onClick={() => router.push('/profil')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px', color: '#fff', cursor: 'pointer' }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '24px', lineHeight: '1.4' }}>
                Tu es sur la bonne voie pour tes objectifs !
            </h2>

            {/* CARTE STATUT KILLED / REDESIGNED */}
            <div style={{ background: '#141414', borderRadius: '24px', padding: '24px', border: '0.5px solid #222', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '200px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="200" height="120" viewBox="0 0 200 120">
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#222" strokeWidth="12" strokeLinecap="round" />
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#arcGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="251.32" strokeDashoffset={251.32 - (251.32 * Math.min(100, (dailyCalories / calorieTarget) * 100)) / 100} style={{ transition: 'stroke-dashoffset 1s ease' }} />
                        <defs>
                            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div style={{ position: 'absolute', bottom: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{remaining}</div>
                        <div style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>kcal rest.</div>
                    </div>
                    <div style={{ position: 'absolute', left: '0', bottom: '0', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{dailyCalories}</div>
                        <div style={{ fontSize: '10px', color: '#444' }}>mangé</div>
                    </div>
                    <div style={{ position: 'absolute', right: '0', bottom: '0', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{calorieTarget}</div>
                        <div style={{ fontSize: '10px', color: '#444' }}>objectif</div>
                    </div>
                </div>
            </div>

            {/* ALERTE EXPIRATION */}
            {isExpiringSoon && !isDismissed && (
                <div
                    onClick={isRenewing ? undefined : handleRenew}
                    style={{
                        background: isRenewing ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.1)',
                        border: '1.5px solid rgba(239,68,68,0.3)',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isRenewing ? 'default' : 'pointer',
                        animation: isRenewing ? 'none' : 'pulse 2s infinite',
                        opacity: isRenewing ? 0.7 : 1,
                        position: 'relative'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>{isRenewing ? '⏳' : '⚠️'}</span>
                        <div>
                            <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: '800' }}>
                                {isRenewing ? 'Préparation du paiement...' : `Abonnement ${effectiveTier.toUpperCase()} expire bientôt`}
                            </p>
                            <p style={{ color: 'rgba(239,68,68,0.7)', fontSize: '11px' }}>
                                {isRenewing ? 'Veuillez patienter' : `Il ne vous reste que ${daysLeft} jours d'accès.`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.5)', fontSize: '18px', padding: '4px', cursor: 'pointer' }}>
                        ✕
                    </button>
                </div>
            )}

            {/* MESSAGE COACH */}
            <div style={{ background: '#141414', border: '0.5px solid #222', borderRadius: '14px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '0.5px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    {coachMsg.emoji}
                </div>
                <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.5' }}>{coachMsg.text}</p>
            </div>

            {/* PLANNER SUGGESTION */}
            <PlannerCard />

            {/* MACROS REDESIGNED AS PILLS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', gap: '10px' }}>
                {[
                    { label: 'Glucides', val: dailyCarbs, target: carbsTarget, title: 'Glucides', bg: '#e0f2fe', color: '#0ea5e9' },
                    { label: 'Protéines', val: dailyProtein, target: proteinTarget, title: 'Protéines', bg: '#f0fdf4', color: '#22c55e' },
                    { label: 'Lipides', val: dailyFat, target: fatTarget, title: 'Lipides', bg: '#fffbeb', color: '#f59e0b' },
                ].map((m) => (
                    <div key={m.title} style={{
                        flex: 1, background: m.bg, borderRadius: '16px', padding: '12px 6px', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                        <p style={{ color: m.color, fontSize: '11px', fontWeight: '700' }}>{m.title}</p>
                        <p style={{ color: '#111', fontSize: '12px', fontWeight: '800' }}>{Math.round(m.val)}/{m.target}</p>
                    </div>
                ))}
            </div>

            {/* GRAPHIQUE 7 DERNIERS JOURS */}
            <WeeklyProgressChart targetKcal={calorieTarget} tier={effectiveTier} />

            {/* REPAS GROUPÉS PAR SLOTS */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>Tous les repas</h2>
                    <span onClick={() => fileInputRef.current?.click()} style={{ fontSize: '20px', color: '#6366f1', cursor: 'pointer' }}>+</span>
                </div>

                {isLoading ? (
                    <p style={{ color: '#333', fontSize: '13px' }}>Chargement...</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                            { id: 'petit_dejeuner' as MealSlotKey, label: 'Petit-déjeuner', icon: '🥛' },
                            { id: 'dejeuner' as MealSlotKey, label: 'Déjeuner', icon: '🍲' },
                            { id: 'collation' as MealSlotKey, label: 'Collation', icon: '🥜' },
                            { id: 'diner' as MealSlotKey, label: 'Dîner', icon: '🥗' },
                        ].map(slot => {
                            const slotState = useAppStore.getState().slots[slot.id]
                            const pct = Math.min(100, (slotState.consumed / slotState.target) * 100)

                            return (
                                <div
                                    key={slot.id}
                                    onClick={() => {
                                        // Optionnel: Voir les repas détaillés du créneau
                                        const slotMeals = todayMeals.filter(m => {
                                            const hour = new Date(m.logged_at).getHours()
                                            const s = getMealSlot(hour)
                                            return s === slot.id
                                        })
                                        if (slotMeals.length > 0) {
                                            const details = slotMeals.map(m => `- ${m.custom_name || 'Repas'} (${Math.round(m.calories)} kcal)`).join('\n')
                                            alert(`${slot.label} :\n${details}`)
                                        }
                                    }}
                                    style={{
                                        background: '#141414', border: '0.5px solid #222', borderRadius: '18px',
                                        padding: '16px', display: 'flex', alignItems: 'center', gap: '14px',
                                        cursor: 'pointer', transition: 'transform 0.2s'
                                    }}
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        {slot.icon}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{slot.label}</p>
                                            <p style={{ fontSize: '12px', color: '#555' }}>
                                                <span style={{ color: '#fff' }}>{Math.round(slotState.consumed)}</span>/{slotState.target} kcal
                                            </p>
                                        </div>
                                        <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)', borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>


            {/* FAB */}
            <>
                <button onClick={() => fileInputRef.current?.click()} style={{
                    position: 'fixed', bottom: '80px', right: '24px',
                    width: '58px', height: '58px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #10b981)',
                    border: 'none', fontSize: '26px', color: '#fff',
                    boxShadow: '0 8px 28px rgba(99,102,241,0.4)',
                    cursor: 'pointer', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</button>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                            ; (window as any).tempImage = file
                        router.push('/scanner')
                    }}
                />
            </>
        </div>
    )
}