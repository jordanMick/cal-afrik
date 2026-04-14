'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore, getMealSlot, type MealSlotKey } from '@/store/useAppStore'
import { getProgressPercent } from '@/lib/nutrition'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getEffectiveTier } from '@/lib/subscription'

const toLocalDateString = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

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

                const dateFrom = toLocalDateString(sevenDaysAgo)
                const dateTo = toLocalDateString(today)
                const tzOffset = new Date().getTimezoneOffset()

                const res = await fetch(`/api/meals?date_from=${dateFrom}&date_to=${dateTo}&tz_offset_min=${tzOffset}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
                const json = await res.json()
                if (json.success) {
                    const meals = json.data as { logged_at: string, calories: number }[]
                    const dailyTotals: Record<string, number> = {}

                    // Initialisation des 7 derniers jours à zéro
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date(today)
                        d.setDate(today.getDate() - i)
                        dailyTotals[toLocalDateString(d)] = 0
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
        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '20px', padding: '20px', marginBottom: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Chargement des analyses...
        </div>
    );

    const maxCal = Math.max(targetKcal, ...weeklyData.map(d => d.calories), Math.min(targetKcal + 500, 3000))
    const isLocked = tier === 'free'

    return (
        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '20px', padding: '20px', marginBottom: '28px', position: 'relative', overflow: 'hidden' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '3px', height: '14px', background: 'linear-gradient(var(--warning), #ec4899)', borderRadius: '2px' }} />
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
                            <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'flex-end', background: 'rgba(var(--text-primary-rgb), 0.03)', borderRadius: '6px', position: 'relative' }}>
                                {/* Barre de l'objectif sur le conteneur du fond */}
                                <div style={{ position: 'absolute', bottom: `${(targetKcal / maxCal) * 100}%`, left: 0, right: 0, height: '1px', background: 'rgba(var(--text-primary-rgb), 0.1)', zIndex: 0 }} />

                                <div style={{
                                    width: '100%',
                                    height: `${heightValue}%`,
                                    background: isExceeded ? 'linear-gradient(180deg, var(--danger), var(--warning))' : 'linear-gradient(180deg, var(--accent), var(--success))',
                                    borderRadius: day.calories > 0 ? '6px' : '0',
                                    transition: 'height 1s ease-out',
                                    zIndex: 1,
                                    opacity: day.calories === 0 ? 0 : 1
                                }} />
                            </div>
                            <span style={{ color: day.date === toLocalDateString() ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '11px', fontWeight: '600' }}>{dayLabel}</span>
                        </div>
                    )
                })}
            </div>

            {isLocked ? (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(var(--bg-primary-rgb), 0.6)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, padding: '20px', textAlign: 'center'
                }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(var(--accent-rgb), 0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '8px', border: '0.5px solid rgba(var(--accent-rgb), 0.3)' }}>
                        🔒
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Analyses Coach Yao</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '14px', maxWidth: '200px' }}>Débloquez le plan Pro pour suivre votre constance hebdomadaire.</p>
                    <button
                        onClick={() => router.push('/upgrade')}
                        style={{
                            background: 'var(--accent)', border: 'none', borderRadius: '8px',
                            color: '#fff', fontSize: '12px', fontWeight: '600', padding: '8px 16px', cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)'
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
                            background: isGood ? 'rgba(var(--success-rgb), 0.06)' : 'rgba(var(--warning-rgb), 0.06)',
                            border: `0.5px solid ${isGood ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--warning-rgb), 0.2)'}`,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px'
                        }}>
                             <span style={{ fontSize: '16px' }}>{isGood ? '🎯' : '📊'}</span>
                             <p style={{ color: isGood ? 'var(--success)' : 'var(--warning)', fontSize: '11px', lineHeight: '1.5', fontWeight: '500' }}>
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

    const { profile, todayMeals, setTodayMeals, removeMeal, dailyCalories, dailyProtein, dailyCarbs, dailyFat, dailyReview, setDailyReview } = useAppStore()

    const [isLoading, setIsLoading] = useState(true)
    // Mis à jour à chaque arrivée sur la page pour refléter l'heure réelle
    const [currentHour, setCurrentHour] = useState(new Date().getHours())

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65
    const remaining = Math.max(0, calorieTarget - dailyCalories)
    const exceeded = dailyCalories > calorieTarget

    const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const status = params.get('status')
        
        if (status === 'approved' || params.get('payment') === 'success') {
            setShowPaymentSuccess(true)
            
            // 1. Un petit délai pour laisser au webhook le temps de passer
            const timer = setTimeout(() => {
                fetchProfile()
            }, 2000)

            // 2. Faire disparaître le message après 6 secondes
            const hideTimer = setTimeout(() => {
                setShowPaymentSuccess(false)
            }, 6000)

            // 3. Nettoyer l'URL pour ne pas que le message revienne au refresh
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)

            return () => {
                clearTimeout(timer)
                clearTimeout(hideTimer)
            }
        }
    }, [])

    const fetchProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const { data } = await supabase.from('user_profiles').select('*').eq('user_id', session.user.id).single()
            if (data) useAppStore.getState().setProfile(data)
        } catch (e) {
            console.error('Erreur refresh profil:', e)
        }
    }

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

    const coachMsg = (() => {
        const today = toLocalDateString()
        const hour = currentHour

        // 1. Si on a déjà mangé aujourd'hui, on affiche le message en temps réel
        if (todayMeals.length > 0) {
            const currentMsg = getCoachMessage()
            // Sauvegarde auto du bilan final (à partir de 21h ou si dépassé)
            if (hour >= 21 || exceeded) {
                if (dailyReview?.date !== today || dailyReview?.text !== currentMsg.text) {
                    setDailyReview({ ...currentMsg, date: today })
                }
            }
            
            // À partir de 23h, on affiche explicitement que c'est le bilan de la journée
            if (hour >= 23) {
                return { ...currentMsg, text: `Bilan de la journée : ${currentMsg.text}` }
            }
            
            return currentMsg
        }

        // 2. Si on n'a pas encore mangé aujourd'hui mais qu'on a un bilan d'hier
        if (dailyReview && dailyReview.date !== today) {
            return { emoji: '📊', text: `Hier : ${dailyReview.text}` }
        }

        // 3. Sinon, message morning standard
        return getCoachMessage()
    })()

    useEffect(() => { fetchMeals() }, [])

    const fetchMeals = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const today = toLocalDateString()
            const tzOffset = new Date().getTimezoneOffset()
            const res = await fetch(`/api/meals?date=${today}&tz_offset_min=${tzOffset}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
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
        { label: 'Protéines', val: dailyProtein, target: proteinTarget, color: 'var(--accent)', bg: 'rgba(var(--accent-rgb), 0.12)' },
        { label: 'Glucides', val: dailyCarbs, target: carbsTarget, color: 'var(--warning)', bg: 'rgba(var(--warning-rgb), 0.12)' },
        { label: 'Lipides', val: dailyFat, target: fatTarget, color: 'var(--success)', bg: 'rgba(var(--success-rgb), 0.12)' },
    ]

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '30px 20px 120px',
            color: 'var(--text-primary)',
            position: 'relative',
            overflow: 'hidden',
        }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            
            {/* BANNIÈRE SUCCÈS PAIEMENT */}
            <AnimatePresence>
                {showPaymentSuccess && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ 
                            background: 'linear-gradient(90deg, var(--success), #059669)',
                            color: '#fff',
                            padding: '12px 20px',
                            borderRadius: '16px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 8px 20px rgba(var(--success-rgb), 0.3)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>🎉</span>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '800' }}>Paiement réussi !</p>
                                <p style={{ fontSize: '11px', opacity: 0.9 }}>Votre plan a été mis à jour avec succès.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowPaymentSuccess(false)}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px' }}
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '5px' }}>Cal Afrik</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>👋 Hello {profile?.name?.split(' ')[0] || 'Ami'}!</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🔥</div>
                    <div onClick={() => router.push('/profil')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent), #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px', color: '#fff', cursor: 'pointer' }}>
                        {profile?.name?.[0] || 'U'}
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '24px', lineHeight: '1.4' }}>
                Tu es sur la bonne voie pour tes objectifs !
            </h2>

            {/* CARTE STATUT KILLED / REDESIGNED */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '24px', border: '0.5px solid var(--border-color)', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '200px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* On ajoute une key={dailyCalories} pour forcer le re-rendu complet sur iPhone lors du changement de données */}
                    <svg key={`${dailyCalories}-${calorieTarget}`} width="200" height="120" viewBox="0 0 200 120">
                        {/* Arrière-plan (gris) */}
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--border-color)" strokeWidth="12" strokeLinecap="round" />
                        
                        {/* Jauge progressive (Dégradé Global depuis layout.tsx) */}
                        <motion.path 
                            d="M 20 100 A 80 80 0 0 1 180 100" 
                            fill="none" 
                            stroke="url(#globalDashboardArcGrad)" 
                            strokeWidth="12" 
                            strokeLinecap="round" 
                            strokeDasharray="251.32" 
                            initial={{ strokeDashoffset: 251.32 }}
                            animate={{ 
                                strokeDashoffset: 251.32 - (251.32 * Math.min(1, (dailyCalories || 0) / (calorieTarget || 2000))) 
                            }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ 
                                // Sécurité : au cas où le gradient met du temps à se lier, une couleur unie très proche
                                stroke: dailyCalories > (calorieTarget * 0.7) ? 'var(--success)' : 'var(--warning)',
                                strokeOpacity: 0.8
                            }}
                        />
                    </svg>
                    <div style={{ position: 'absolute', bottom: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)' }}>{remaining}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>kcal rest.</div>
                    </div>
                    <div style={{ position: 'absolute', left: '0', bottom: '0', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{dailyCalories}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>mangé</div>
                    </div>
                    <div style={{ position: 'absolute', right: '0', bottom: '0', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{calorieTarget}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>objectif</div>
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
                            <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '800' }}>
                                {isRenewing ? 'Préparation du paiement...' : `Abonnement ${effectiveTier.toUpperCase()} expire bientôt`}
                            </p>
                            <p style={{ color: 'rgba(var(--danger-rgb), 0.7)', fontSize: '11px' }}>
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
            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '14px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(var(--accent-rgb), 0.15)', border: '0.5px solid rgba(var(--accent-rgb), 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    {coachMsg.emoji}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>{coachMsg.text}</p>
            </div>

            {/* MACROS REDESIGNED AS PILLS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', gap: '10px' }}>
                {[
                    { label: 'Glucides', val: dailyCarbs, target: carbsTarget, title: 'Glucides', bg: 'rgba(var(--warning-rgb), 0.12)', color: 'var(--warning)' },
                    { label: 'Protéines', val: dailyProtein, target: proteinTarget, title: 'Protéines', bg: 'rgba(var(--accent-rgb), 0.12)', color: 'var(--accent)' },
                    { label: 'Lipides', val: dailyFat, target: fatTarget, title: 'Lipides', bg: 'rgba(var(--success-rgb), 0.12)', color: 'var(--success)' },
                ].map((m) => (
                    <div key={m.title} style={{
                        flex: 1, background: m.bg, borderRadius: '16px', padding: '12px 6px', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                        <p style={{ color: m.color, fontSize: '11px', fontWeight: '700' }}>{m.title}</p>
                        <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '800' }}>{Math.round(m.val)}/{m.target}</p>
                    </div>
                ))}
            </div>

            {/* GRAPHIQUE 7 DERNIERS JOURS */}
            <WeeklyProgressChart targetKcal={calorieTarget} tier={effectiveTier} />



            {/* REPAS GROUPÉS PAR SLOTS */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Tous les repas</h2>
                    <span onClick={() => fileInputRef.current?.click()} style={{ fontSize: '20px', color: 'var(--accent)', cursor: 'pointer' }}>+</span>
                </div>

                {isLoading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Chargement...</p>
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
                                        background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '18px',
                                        padding: '16px', display: 'flex', alignItems: 'center', gap: '14px',
                                        cursor: 'pointer', transition: 'transform 0.2s'
                                    }}
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(var(--text-primary-rgb), 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        {slot.icon}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{slot.label}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                <span style={{ color: 'var(--text-primary)' }}>{Math.round(slotState.consumed)}</span>/{slotState.target} kcal
                                            </p>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--success))', borderRadius: '3px' }} />
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
                    background: 'linear-gradient(135deg, var(--accent), var(--success))',
                    border: 'none', fontSize: '26px', color: '#fff',
                    boxShadow: '0 8px 28px rgba(var(--accent-rgb), 0.4)',
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