'use client'

import { useEffect, useState, useRef } from 'react'
import { useAppStore, getMealSlot, type MealSlotKey } from '@/store/useAppStore'
import { type Meal } from '@/types'
import { getProgressPercent, getStreakIcon } from '@/lib/nutrition'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getEffectiveTier } from '@/lib/subscription'
import { toast } from 'sonner'
import { Settings, AlertTriangle, X, ShieldAlert, Edit2, Check, Clock, Trash2, User, Bell, LogOut, ChevronDown } from 'lucide-react'
import NotificationCenter from '@/components/NotificationCenter'
import PushNotificationManager from '@/components/PushNotificationManager'
import SurpriseManager from '@/components/SurpriseManager'
import { LeafIcon } from '@/components/icons/LeafIcon'

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
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '3px', height: '12px', background: 'linear-gradient(var(--success), var(--branding))', borderRadius: '2px' }} />
                7 derniers jours
            </h2>

            <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '80px', gap: '6px',
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
                        <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                            <div style={{ width: '100%', height: '60px', display: 'flex', alignItems: 'flex-end', background: 'rgba(var(--text-primary-rgb), 0.03)', borderRadius: '6px', position: 'relative' }}>
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
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fff', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', marginBottom: '6px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(var(--success-rgb), 0.2)' }}>
                        🔒
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '800', marginBottom: '2px' }}>Analyses Coach Yao</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '10px', maxWidth: '180px', fontWeight: '500' }}>Passe au plan Pro pour débloquer ton suivi.</p>
                    <button
                        onClick={() => router.push('/upgrade')}
                        style={{
                            background: 'linear-gradient(135deg, var(--branding), var(--success))', border: 'none', borderRadius: '10px',
                            color: '#fff', fontSize: '11px', fontWeight: '800', padding: '6px 14px', cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(var(--success-rgb), 0.3)'
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

    const { 
        profile, todayMeals, setTodayMeals, removeMeal, 
        dailyCalories, dailyProtein, dailyCarbs, dailyFat, 
        dailyReview, setDailyReview, smartAlert, clearSmartAlert, slots
    } = useAppStore()

    const [isLoading, setIsLoading] = useState(true)
    const [streak, setStreak] = useState(0)
    // Mis à jour à chaque arrivée sur la page pour refléter l'heure réelle
    const [currentHour, setCurrentHour] = useState(new Date().getHours())

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65
    const remaining = Math.round(Math.max(0, calorieTarget - dailyCalories))
    const exceeded = dailyCalories > calorieTarget

    const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [dismissedCoachMsg, setDismissedCoachMsg] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Fermer le menu si on clique ailleurs
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsProfileMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        // Charger l'avatar
        const loadAvatar = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            const meta = user?.user_metadata
            if (user?.email) {
                setUserEmail(user.email)
            }
            if (meta?.avatar_url || meta?.picture) {
                setAvatarUrl(meta.avatar_url || meta.picture)
            }
        }
        loadAvatar()

        // Charger le message Coach Yao déjà ignoré depuis le localStorage
        const savedMsg = localStorage.getItem('dismissedCoachMsg')
        if (savedMsg) setDismissedCoachMsg(savedMsg)
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const status = params.get('status')
        const transactionId = params.get('id') || params.get('transaction_id')
        
        if (status === 'approved' || params.get('payment') === 'success') {
            setShowPaymentSuccess(true)
            
            // On lance la vérification manuelle pour pallier aux pannes de Webhooks
            const verifyPayment = async () => {
                if (!transactionId) return;
                try {
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    
                    await fetch('/api/payments/verify', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ transactionId })
                    })
                    // Dès que la vérif est finie, on met à jour le profil localement
                    await fetchProfile()
                } catch (e) {
                    console.error('Erreur vérification FedaPay fallback:', e)
                }
            }

            verifyPayment()

            // Rafraîchissements multiples au cas où (si le webhook finit par passer)
            let attempts = 0
            const interval = setInterval(async () => {
                attempts++
                await fetchProfile()
                if (useAppStore.getState().profile?.subscription_tier !== 'free') {
                    clearInterval(interval)
                }
                if (attempts >= 5) clearInterval(interval)
            }, 3000)

            // Faire disparaître le message après 8 secondes
            const hideTimer = setTimeout(() => {
                setShowPaymentSuccess(false)
            }, 8000)

            // Nettoyer l'URL
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)

            return () => {
                clearInterval(interval)
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

    // Modal Details Repas
    const [selectedSlotMeals, setSelectedSlotMeals] = useState<Meal[]>([])
    const [selectedSlotLabel, setSelectedSlotLabel] = useState('')
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false)
    const [editingMealId, setEditingMealId] = useState<string | null>(null)
    const [tempMealName, setTempMealName] = useState('')
    const [isSavingName, setIsSavingName] = useState(false)

    const handleOpenSlotModal = (slot: { id: MealSlotKey, label: string }) => {
        const slotMeals = todayMeals.filter(m => {
            const hour = new Date(m.logged_at).getHours()
            const s = getMealSlot(hour)
            return s === slot.id
        })
        setSelectedSlotMeals(slotMeals)
        setSelectedSlotLabel(slot.label)
        setIsSlotModalOpen(true)
    }

    const handleUpdateMealName = async (mealId: string) => {
        if (!tempMealName.trim()) return
        setIsSavingName(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch(`/api/meals`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ id: mealId, custom_name: tempMealName })
            })
            const json = await res.json()
            if (json.success) {
                // Mettre à jour localement
                useAppStore.setState(state => ({
                    todayMeals: state.todayMeals.map(m => m.id === mealId ? { ...m, custom_name: tempMealName } : m)
                }))
                setSelectedSlotMeals(prev => prev.map(m => m.id === mealId ? { ...m, custom_name: tempMealName } : m))
                setEditingMealId(null)
                toast.success('Nom du repas mis à jour !')
            } else {
                toast.error('Erreur lors de la mise à jour')
            }
        } catch (err) {
            console.error(err)
            toast.error('Erreur serveur')
        } finally {
            setIsSavingName(false)
        }
    }

    const handleDeleteMeal = async (mealId: string) => {
        if (!confirm('Voulez-vous vraiment supprimer ce repas ?')) return
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch(`/api/meals?id=${mealId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) {
                removeMeal(mealId)
                setSelectedSlotMeals(prev => prev.filter(m => m.id !== mealId))
                if (selectedSlotMeals.length <= 1) setIsSlotModalOpen(false)
                toast.success('Repas supprimé')
            }
        } catch (err) { console.error(err) }
    }

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
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Une erreur est survenue'
            toast.error(`Erreur: ${msg}`);
        } finally {
            setIsRenewing(false);
        }
    }

    // Logique d'expiration
    const effectiveTier = getEffectiveTier(profile)
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
    const isExpiringSoon = effectiveTier !== 'free' && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0

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
            
            // À partir de 21h (heure du bilan), on affiche explicitement que c'est le bilan de la journée
            if (hour >= 21) {
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

    useEffect(() => { 
        fetchMeals() 
        const fetchStreak = async () => {
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
                    const meals = json.data as { logged_at: string }[]
                    const mealsByDay: Record<string, boolean> = {}
                    meals.forEach(m => mealsByDay[m.logged_at.split('T')[0]] = true)
                    
                    let s = 0
                    const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return toLocalDateString(d) })
                    let startIndex = 0
                    if (!mealsByDay[last7[0]]) startIndex = 1
                    for (let i = startIndex; i < 7; i++) {
                        if (mealsByDay[last7[i]]) s++
                        else break
                    }
                    setStreak(s)
                }
            } catch (e) {}
        }
        fetchStreak()
    }, [])

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <LeafIcon size={32} />
                    <div>
                        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px' }}>Cal Afrik</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>👋 Hello {profile?.name?.split(' ')[0] || 'Ami'}!</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {streak > 0 && (
                        <div onClick={() => router.push('/journal')} style={{ 
                            height: '36px', 
                            borderRadius: '10px', 
                            background: 'rgba(var(--warning-rgb), 0.1)', 
                            border: '0.5px solid rgba(var(--warning-rgb), 0.3)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            padding: '0 10px',
                            gap: '4px',
                            cursor: 'pointer'
                        }}>
                            <span style={{ fontSize: '18px' }}>{getStreakIcon(streak)}</span>
                            <span style={{ color: 'var(--warning)', fontSize: '14px', fontWeight: '800' }}>{streak}</span>
                        </div>
                    )}
                    <div onClick={() => router.push('/settings')} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Settings color="var(--text-secondary)" size={20} strokeWidth={1.5} />
                    </div>

                    {/* AVATAR PROFIL AVEC DROPDOWN */}
                    <div style={{ position: 'relative' }} ref={menuRef}>
                        <div 
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, var(--accent), #ec4899)', 
                                border: '2px solid var(--bg-secondary)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                overflow: 'hidden',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                                fontSize: '14px',
                                fontWeight: '800',
                                color: '#fff'
                            }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    profile?.name?.charAt(0).toUpperCase() || 'U'
                                )}
                            </div>
                            <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: isProfileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>

                        {/* DROPDOWN MENU */}
                        <AnimatePresence>
                            {isProfileMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 12px)',
                                        right: 0,
                                        width: '240px',
                                        background: 'var(--bg-secondary)',
                                        border: '0.5px solid var(--border-color)',
                                        borderRadius: '16px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                                        zIndex: 1000,
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Header Menu */}
                                    <div style={{ padding: '16px', borderBottom: '0.5px solid var(--border-color)', background: 'rgba(var(--text-primary-rgb), 0.02)' }}>
                                        <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{profile?.name || 'Utilisateur'}</p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail || ''}</p>
                                    </div>

                                    {/* Items Menu */}
                                    <div style={{ padding: '8px' }}>
                                        <div 
                                            onClick={() => { router.push('/profil'); setIsProfileMenuOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.2s' }}
                                            className="menu-item-hover"
                                        >
                                            <User size={18} color="var(--text-secondary)" />
                                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Profil</span>
                                        </div>
                                        <div 
                                            onClick={() => { router.push('/notifications'); setIsProfileMenuOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.2s' }}
                                            className="menu-item-hover"
                                        >
                                            <Bell size={18} color="var(--text-secondary)" />
                                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Notifications</span>
                                        </div>
                                        <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />
                                        
                                        <div 
                                            onClick={() => { setShowLogoutConfirm(true); setIsProfileMenuOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.2s' }}
                                            className="menu-item-hover"
                                        >
                                            <LogOut size={18} color="#ef4444" />
                                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#ef4444' }}>Déconnexion</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <SurpriseManager />
            <PushNotificationManager />
            


            {/* MODAL DE DÉCONNEXION */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLogoutConfirm(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                width: '100%', maxWidth: '340px', background: 'var(--bg-secondary)', borderRadius: '28px', padding: '32px 24px',
                                border: '0.5px solid var(--border-color)', textAlign: 'center', position: 'relative', zIndex: 5001,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                            }}
                        >
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <LogOut size={28} color="#ef4444" />
                            </div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Déconnexion</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '28px' }}>Êtes-vous sûr de vouloir vous déconnecter ?</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button 
                                    onClick={async () => {
                                        await supabase.auth.signOut()
                                        window.location.href = '/login'
                                    }} 
                                    style={{ width: '100%', padding: '16px', background: '#ef4444', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '800', cursor: 'pointer' }}
                                >
                                    Oui, me déconnecter
                                </button>
                                <button onClick={() => setShowLogoutConfirm(false)} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                                    Annuler
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>



            <h2 className="text-gradient" style={{ fontSize: '22px', fontWeight: '900', marginBottom: '28px', lineHeight: '1.3', letterSpacing: '-0.5px' }}>
                Tu es sur la bonne voie pour tes objectifs !
            </h2>

            {/* SMART ALERT COACH YAO */}
            <AnimatePresence>
                {smartAlert && !smartAlert.dismissed && smartAlert.date === toLocalDateString() && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        style={{ overflow: 'hidden', marginBottom: '24px' }}
                    >
                        <div style={{
                            background: smartAlert.level === 'danger' ? 'rgba(var(--danger-rgb), 0.08)' : 'rgba(var(--warning-rgb), 0.08)',
                            border: `1px solid ${smartAlert.level === 'danger' ? 'var(--danger)' : 'var(--warning)'}33`,
                            borderRadius: '24px',
                            padding: '16px 20px',
                            display: 'flex',
                            gap: '14px',
                            position: 'relative',
                            boxShadow: `0 8px 24px ${smartAlert.level === 'danger' ? 'rgba(var(--danger-rgb), 0.1)' : 'rgba(var(--warning-rgb), 0.1)'}`
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '12px',
                                background: smartAlert.level === 'danger' ? 'rgba(var(--danger-rgb), 0.15)' : 'rgba(var(--warning-rgb), 0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                {smartAlert.level === 'danger' ? <ShieldAlert size={20} color="var(--danger)" /> : <AlertTriangle size={20} color="var(--warning)" />}
                            </div>
                            <div style={{ flex: 1, paddingRight: '20px' }}>
                                <p style={{ color: smartAlert.level === 'danger' ? 'var(--danger)' : 'var(--warning)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                                    Conseil Coach Yao
                                </p>
                                <p style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.5', fontWeight: '500' }}>
                                    {smartAlert.message}
                                </p>
                            </div>
                            <button 
                                onClick={clearSmartAlert}
                                style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CARTE STATUT CIRCULAIRE (Nouveau Layout) */}
            <div className="glass-panel" style={{ borderRadius: '32px', padding: '24px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '42px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1', letterSpacing: '-1px' }}>{Math.round(remaining)}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '700', marginTop: '6px', opacity: 0.8 }}>Calories restantes</div>
                    
                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{dailyCalories}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Mangé</div>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{calorieTarget}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Objectif</div>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                        {/* Fond du cercle */}
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(var(--text-primary-rgb), 0.04)" strokeWidth="10" />
                        {/* Jauge circulaire */}
                        <motion.circle 
                            cx="50" cy="50" r="42" fill="none" 
                            stroke="url(#globalDashboardArcGrad)" 
                            strokeWidth="10" 
                            strokeLinecap="round" 
                            strokeDasharray="263.89" 
                            initial={{ strokeDashoffset: 263.89 }}
                            animate={{ 
                                strokeDashoffset: 263.89 * (1 - Math.min(1, (dailyCalories || 0) / (calorieTarget || 2000))) 
                            }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ 
                                transform: 'rotate(-90deg)', 
                                transformOrigin: 'center',
                                filter: 'drop-shadow(0 0 6px rgba(var(--success-rgb), 0.3))'
                            }}
                        />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                        🔥
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
            {coachMsg && coachMsg.text !== dismissedCoachMsg && (
                <div style={{ 
                    background: 'rgba(var(--bg-secondary-rgb), 0.4)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '18px', 
                    padding: '14px 18px', 
                    marginBottom: '24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    position: 'relative'
                }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#0a0a0a', border: '1px solid rgba(var(--accent-rgb), 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, boxShadow: '0 0 15px rgba(var(--accent-rgb), 0.2)' }}>
                        {coachMsg.emoji}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.5', fontWeight: '500', flex: 1, paddingRight: '20px' }}>{coachMsg.text}</p>
                    <button 
                        onClick={() => {
                            setDismissedCoachMsg(coachMsg.text)
                            localStorage.setItem('dismissedCoachMsg', coachMsg.text)
                        }}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* MACROS REDESIGNED AS VERTICAL CARDS (Inspiré de l'image) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', gap: '12px' }}>
                {[
                    { label: 'Proteines', val: dailyProtein, target: proteinTarget, emoji: '🥩', color: 'var(--accent)' },
                    { label: 'Glucides', val: dailyCarbs, target: carbsTarget, emoji: '🌾', color: 'var(--warning)' },
                    { label: 'Lipides', val: dailyFat, target: fatTarget, emoji: '🥑', color: 'var(--success)' },
                ].map((m) => {
                    const remainingMacro = Math.max(0, m.target - m.val);
                    const percent = Math.min(1, m.val / m.target);
                    
                    return (
                        <div key={m.label} className="glass-panel" style={{
                            flex: 1, borderRadius: '24px', padding: '16px 10px', textAlign: 'center',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                        }}>
                            <div style={{ textAlign: 'left', width: '100%', paddingLeft: '8px' }}>
                                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '900' }}>{Math.round(remainingMacro)}g</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700' }}>{m.label}</p>
                            </div>

                            <div style={{ position: 'relative', width: '44px', height: '44px' }}>
                                <svg width="44" height="44" viewBox="0 0 44 44">
                                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(var(--text-primary-rgb), 0.05)" strokeWidth="4" />
                                    <motion.circle 
                                        cx="22" cy="22" r="18" fill="none" 
                                        stroke={m.color} strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray="113.1"
                                        initial={{ strokeDashoffset: 113.1 }}
                                        animate={{ strokeDashoffset: 113.1 * (1 - percent) }}
                                        transition={{ duration: 1.5 }}
                                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                                    {m.emoji}
                                </div>
                            </div>
                        </div>
                    )
                })}
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
                            const slotState = slots[slot.id]
                            const pct = Math.min(100, (slotState.consumed / slotState.target) * 100)

                            return (
                                <div
                                    key={slot.id}
                                    onClick={() => handleOpenSlotModal(slot)}
                                    style={{
                                        background: 'rgba(var(--bg-secondary-rgb), 0.7)',
                                        backdropFilter: 'blur(10px)',
                                        border: '0.5px solid var(--border-color)',
                                        borderRadius: '18px',
                                        padding: '16px', display: 'flex', alignItems: 'center', gap: '14px',
                                        cursor: 'pointer', transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(var(--text-primary-rgb), 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        {slot.icon}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{slot.label}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                <span style={{ color: 'var(--text-primary)' }}>{Math.round(slotState.consumed)}</span>/{Math.round(slotState.target)} kcal
                                            </p>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #059669, var(--success))', borderRadius: '3px' }} />
                                        </div>
                                        {effectiveTier === 'premium' && (
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--accent)' }}>P</span> {Math.round(slotState.protein_consumed)}/{Math.round(slotState.protein_target)}g
                                                </span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--warning)' }}>G</span> {Math.round(slotState.carbs_consumed)}/{Math.round(slotState.carbs_target)}g
                                                </span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--success)' }}>L</span> {Math.round(slotState.fat_consumed)}/{Math.round(slotState.fat_target)}g
                                                </span>
                                            </div>
                                        )}
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
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', fontSize: '26px', color: 'var(--success)',
                    boxShadow: '0 8px 24px rgba(var(--success-rgb), 0.4)',
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

            {/* MODAL DÉTAILS CRÉNEAU */}
            <AnimatePresence>
                {isSlotModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSlotModalOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'relative', width: '100%', maxWidth: '480px',
                                background: 'var(--bg-primary)', borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
                                padding: '24px', paddingBottom: '40px', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                                maxHeight: '85vh', overflowY: 'auto'
                            }}
                        >
                            <div style={{ width: '40px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 20px', opacity: 0.5 }} />
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedSlotLabel}</h3>
                                <button onClick={() => setIsSlotModalOpen(false)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {selectedSlotMeals.length > 0 ? selectedSlotMeals.map(meal => (
                                    <div key={meal.id} style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '16px', border: '0.5px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                            {meal.image_url ? (
                                                <img src={meal.image_url} style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} alt="" />
                                            ) : (
                                                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🍲</div>
                                            )}
                                            
                                            <div style={{ flex: 1 }}>
                                                {editingMealId === meal.id ? (
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                                        <input 
                                                            autoFocus
                                                            value={tempMealName} 
                                                            onChange={e => setTempMealName(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleUpdateMealName(meal.id)}
                                                            style={{ 
                                                                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--accent)', 
                                                                borderRadius: '8px', color: 'var(--text-primary)', padding: '6px 10px', fontSize: '14px', outline: 'none' 
                                                            }}
                                                        />
                                                        <button 
                                                            onClick={() => handleUpdateMealName(meal.id)}
                                                            disabled={isSavingName}
                                                            style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', padding: '0 8px', cursor: 'pointer' }}
                                                        >
                                                            {isSavingName ? '...' : <Check size={16} />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                        <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{meal.custom_name || 'Repas'}</p>
                                                        <button 
                                                            onClick={() => { setEditingMealId(meal.id); setTempMealName(meal.custom_name || ''); }}
                                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', opacity: 0.6 }}
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '700' }}>{Math.round(meal.calories)} kcal</span>
                                                    <span style={{ width: '3px', height: '3px', background: 'var(--text-muted)', borderRadius: '50%', opacity: 0.3 }} />
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Clock size={10} /> {new Date(meal.logged_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => handleDeleteMeal(meal.id)}
                                                style={{ padding: '8px', color: 'var(--danger)', opacity: 0.5, cursor: 'pointer', background: 'transparent', border: 'none' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '14px', paddingLeft: '72px' }}>
                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}><span style={{ fontWeight: '700', color: 'var(--accent)' }}>P</span> {Math.round(meal.protein_g)}g</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}><span style={{ fontWeight: '700', color: 'var(--warning)' }}>G</span> {Math.round(meal.carbs_g)}g</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}><span style={{ fontWeight: '700', color: 'var(--success)' }}>L</span> {Math.round(meal.fat_g)}g</div>
                                        </div>
                                    </div>
                                )) : (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Aucun repas enregistré pour ce créneau.</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
