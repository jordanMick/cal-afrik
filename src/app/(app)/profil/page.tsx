'use client'

import { useEffect, useState } from 'react'
import { useAppStore, MealSlotKey, SLOT_LABELS, NEXT_SLOT } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { getProgressPercent } from '@/lib/nutrition'
import { supabase } from '@/lib/supabase'
import { checkPermission, getEffectiveTier } from '@/lib/subscription'
import { Settings, Bell, HelpCircle, LogOut, ChevronRight, Shield, FileText } from 'lucide-react'
import { toast } from 'sonner'

const GOAL_LABELS: Record<string, string> = { perdre: 'Perdre du poids', maintenir: 'Maintenir le poids', prendre: 'Prendre du poids' }
const ACTIVITY_LABELS: Record<string, string> = { sedentaire: 'Sédentaire', leger: 'Légèrement actif', modere: 'Modérément actif', actif: 'Très actif', tres_actif: 'Extrêmement actif' }
const getDaysUntilNextMonth = () => {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const diff = nextMonth.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const daysUntilMonthlyBilan = getDaysUntilNextMonth()

function getActiveBilanSlot(hour: number, minutes: number = 0): MealSlotKey {
    // Règle : Un bilan reste affiché jusqu'à 30 minutes avant le début du suivant
    const time = hour + minutes / 60

    if (time >= 22.5 || time < 11.5) return 'diner'           // Bilan journée visible de 22h30 à 11h30
    if (time >= 18.5 && time < 22.5) return 'collation'       // Bilan collation visible de 18h30 à 22h30
    if (time >= 15.5 && time < 18.5) return 'dejeuner'        // Bilan déjeuner visible de 15h30 à 18h30
    if (time >= 11.5 && time < 15.5) return 'petit_dejeuner'  // Bilan petit-déjeuner de 11h30 à 15h30

    return 'diner'
}

function getNextSlotInfo(hour: number): { label: string; time: string } {
    if (hour >= 8 && hour < 12) return { label: 'Petit-déjeuner', time: '12h00' }
    if (hour >= 12 && hour < 16) return { label: 'Déjeuner', time: '16h00' }
    if (hour >= 16 && hour < 19) return { label: 'Collation', time: '19h00' }
    if (hour >= 19 && hour < 23) return { label: 'Dîner', time: '23h00' }
    return { label: 'Petit-déjeuner', time: '12h00' }
}


const STAT_COLORS = ['var(--accent)', 'var(--success)', 'var(--warning)', '#ec4899']

export default function ProfilPage() {
    const router = useRouter()
    const { profile, dailyCalories, dailyProtein, dailyCarbs, dailyFat, slots, slotBilans, setSlotBilan, todayMeals } = useAppStore()

    const calorieTarget = profile?.calorie_target || 2000
    const proteinTarget = profile?.protein_target_g || 100
    const carbsTarget = profile?.carbs_target_g || 250
    const fatTarget = profile?.fat_target_g || 65
    const effectiveTier = getEffectiveTier(profile)

    const now = new Date()
    const hour = now.getHours()
    const minutes = now.getMinutes()
    const today = now.toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const isBefore11 = hour < 11
    const bilanDinerDate = isBefore11 ? yesterday : today

    // Calcul de l'urgence d'expiration (J-7)
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
    const isExpiringSoon = effectiveTier !== 'free' && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0

    const activeSlot = getActiveBilanSlot(hour, minutes)
    const bilanDate = activeSlot === 'diner' ? bilanDinerDate : today
    const existingBilan = activeSlot ? slotBilans[activeSlot] : null
    const canUseAIBilanForActiveSlot = !!activeSlot && (
        effectiveTier === 'premium' || (effectiveTier === 'pro' && activeSlot === 'diner')
    )

    // VALIDITÉ : On ajoute un check sur le message si l'utilisateur est Premium
    const needsYaoMessage = profile?.subscription_tier === 'premium' && (!existingBilan?.message || existingBilan.message === "")
    const bilanIsValid = existingBilan && existingBilan.date === bilanDate && !existingBilan.needsRefresh && !needsYaoMessage

    const shouldGenerate = !!activeSlot && canUseAIBilanForActiveSlot && !bilanIsValid
    const shouldShowExisting = !!activeSlot && canUseAIBilanForActiveSlot && bilanIsValid

    // Déterminer le statut initial si on a déjà un bilan
    const getInitialStatus = () => {
        if (!shouldShowExisting) return null
        if (!existingBilan) return null
        if (existingBilan.message === "" && activeSlot !== 'diner') return 'empty'
        return 'done'
    }

    const [bilanStatus, setBilanStatus] = useState<'loading' | 'done' | 'empty' | null>(getInitialStatus())
    const [isRenewing, setIsRenewing] = useState(false)

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
            toast.error(`Erreur: ${error.message}`);
        } finally {
            setIsRenewing(false);
        }
    }

    useEffect(() => {
        if (shouldGenerate) {
            setBilanStatus('loading')
            loadBilan(activeSlot!);
        } else if (shouldShowExisting) {
            setBilanStatus(getInitialStatus())
        }
    }, [activeSlot, profile?.subscription_tier, bilanDate])

    const loadBilan = async (slot: MealSlotKey) => {
        const slotMeals = slot !== 'diner'
            ? todayMeals.filter(m => { const h = new Date(m.logged_at).getHours(); if (slot === 'petit_dejeuner') return h >= 0 && h < 12; if (slot === 'dejeuner') return h >= 12 && h < 16; if (slot === 'collation') return h >= 16 && h < 19; return false })
            : todayMeals

        if (slot !== 'diner' && slotMeals.length === 0) { setBilanStatus('empty'); setSlotBilan(slot, { message: '', goalReached: false, exceeded: false, date: bilanDate, needsRefresh: false }); return }
        setBilanStatus('loading')
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const slotData = slots[slot]
            const nextSlot = NEXT_SLOT[slot]
            const res = await fetch('/api/bilan', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ type: slot === 'diner' ? 'journee' : 'creneau', slot, slotLabel: SLOT_LABELS[slot], nextSlotLabel: nextSlot ? SLOT_LABELS[nextSlot] : null, slotConsumed: slotData.consumed, slotTarget: slotData.target, dailyCalories, dailyProtein, dailyCarbs, dailyFat, calorieTarget, proteinTarget, carbsTarget, fatTarget, goal: profile?.goal || 'maintenir', meals: slotMeals.map(m => ({ name: m.custom_name || 'Repas', calories: m.calories })) }) })
            const json = await res.json()
            if (!json.success) { setSlotBilan(slot, { message: slot === 'diner' ? 'Belle journée ! Repose-toi bien. 💪' : `Bilan ${SLOT_LABELS[slot]} non disponible.`, goalReached: false, exceeded: false, date: bilanDate, needsRefresh: false }); setBilanStatus('done'); return }
            setSlotBilan(slot, { message: json.message, goalReached: json.goalReached, exceeded: json.exceeded, date: bilanDate, needsRefresh: false })
            setBilanStatus('done')
        } catch (err) { console.error(err); setBilanStatus('done') }
    }

    const currentBilan = activeSlot ? slotBilans[activeSlot] : null
    const goalReached = currentBilan?.goalReached ?? false
    const exceeded = currentBilan?.exceeded ?? false
    const bilanMessage = currentBilan?.message ?? ''
    const bilanEmoji = goalReached ? '🎉' : exceeded ? '⚠️' : '📊'
    const bilanTitle = activeSlot === 'diner' ? (goalReached ? 'Objectif atteint !' : exceeded ? 'Objectif dépassé' : 'Journée incomplète') : `Bilan ${activeSlot ? SLOT_LABELS[activeSlot] : ''}`
    const bilanColor = goalReached ? 'var(--success)' : exceeded ? 'var(--danger)' : 'var(--warning)'

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [showSupportModal, setShowSupportModal] = useState(false)
    const handleLogoutTrigger = () => setShowLogoutConfirm(true)
    const confirmLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

    const handleShareWhatsApp = () => {
        const text = `🔥 Bilan du jour sur Cal-Afrik !\n\n📊 Calories: ${Math.round(dailyCalories)} / ${calorieTarget} kcal\n🥩 Protéines: ${Math.round(dailyProtein)}g\n🌾 Glucides: ${Math.round(dailyCarbs)}g\n🥑 Lipides: ${Math.round(dailyFat)}g\n\nRejoins l'app #1 de nutrition en Afrique et atteins tes objectifs en mangeant local ! 🌍\n👉 https://al-afrik.vercel.app`
        const encodedText = encodeURIComponent(text)
        window.open(`https://wa.me/?text=${encodedText}`, '_blank')
    }

    const stats = [
        { label: 'Calories', current: dailyCalories, target: calorieTarget, unit: 'kcal', color: STAT_COLORS[0] },
        { label: 'Protéines', current: dailyProtein, target: proteinTarget, unit: 'g', color: STAT_COLORS[1] },
        { label: 'Glucides', current: dailyCarbs, target: carbsTarget, unit: 'g', color: STAT_COLORS[2] },
        { label: 'Lipides', current: dailyFat, target: fatTarget, unit: 'g', color: STAT_COLORS[3] },
    ]

    // LOGIQUE DE BILAN AUTOMATIQUE (NON-AI) POUR PRO/FREE
    const getAutomatedBilan = () => {
        const calPercent = (dailyCalories / calorieTarget) * 100
        const protPercent = (dailyProtein / proteinTarget) * 100

        let message = ""
        let yaoNudge = ""

        // Logique de message de base (Status actuel)
        if (calPercent > 105) {
            message = "⚠️ Budget calories dépassé. Essayez de compenser sur le prochain repas."
        } else if (calPercent < 80) {
            message = "✅ Vous avez encore de la marge calorique pour aujourd'hui."
        } else {
            message = "🎯 Équilibre calorique exemplaire. Continuez comme ça !"
        }

        if (protPercent < 70) {
            message += " Pensez à augmenter vos protéines."
        }

        // Logique de Nudge Dynamique (Ce que Yao proposerait pour la suite)
        if (activeSlot === 'petit_dejeuner') {
            yaoNudge = calPercent > 30
                ? "Yao vous suggère un déjeuner léger à base de fibres pour équilibrer votre matinée."
                : "Yao a sélectionné des déjeuners locaux riches en fer pour booster votre après-midi."
        } else if (activeSlot === 'dejeuner') {
            yaoNudge = protPercent < 40
                ? "Yao propose une liste de snacks hyper-protéinés (noix, yaourt) pour votre collation de 16h."
                : "Yao a trouvé des idées de collations fruitées pour maintenir votre énergie sans lourdeur."
        } else if (activeSlot === 'collation') {
            yaoNudge = calPercent > 80
                ? "Yao vous conseille un dîner léger (soupe ou poisson) pour finir la journée en beauté."
                : "Yao vous propose des dîners complets et savoureux adaptés à votre budget calorique restant."
        } else { // diner ou fin de journée
            yaoNudge = exceeded
                ? "Yao prépare déjà votre programme détox de demain matin pour compenser ce petit écart."
                : "Yao analyse votre sommeil et vous proposera le petit-déjeuner idéal au réveil."
        }

        return { message, yaoNudge }
    }

    const { message: autoMessage, yaoNudge } = getAutomatedBilan()

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', position: 'relative', overflow: 'hidden', color: 'var(--text-primary)' }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: `52px 20px ${isExpiringSoon ? '8px' : '6px'}` }}>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '800', marginBottom: '24px', letterSpacing: '-0.5px' }}>Mon Profil</h1>

                {/* BLOC PROFIL CONSOLIDÉ */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '24px',
                    padding: '20px',
                    marginBottom: isExpiringSoon ? '8px' : '6px',
                    border: '0.5px solid var(--border-color)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                }}>
                    {/* Décoration en arrière-plan */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: '68px', height: '68px', borderRadius: '22px',
                            background: 'linear-gradient(135deg, var(--accent), #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '30px', fontWeight: 'bold', color: '#fff',
                            boxShadow: '0 8px 16px rgba(var(--bg-primary-rgb),0.4)',
                            flexShrink: 0
                        }}>
                            {profile?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>{profile?.name || 'Utilisateur'}</h2>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ opacity: 0.7 }}>🌍</span> {profile?.country || 'Afrique de l\'Ouest'}
                                </p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ opacity: 0.7 }}>🎯</span> {GOAL_LABELS[profile?.goal || ''] || 'Définir un objectif'}
                                </p>
                            </div>
                             <div style={{
                                display: 'inline-flex', padding: '4px 10px', borderRadius: '10px',
                                background: effectiveTier === 'pro' ? 'rgba(var(--accent-rgb), 0.15)' : effectiveTier === 'premium' ? 'rgba(var(--success-rgb), 0.15)' : 'rgba(var(--text-primary-rgb), 0.05)',
                                color: effectiveTier === 'pro' ? 'var(--accent)' : effectiveTier === 'premium' ? 'var(--success)' : 'var(--text-muted)',
                                fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px', border: '0.5px solid rgba(var(--text-primary-rgb),0.08)',
                                textTransform: 'uppercase'
                            }}>
                                PLAN {effectiveTier.toUpperCase()}
                            </div>
                            {profile?.subscription_expires_at && effectiveTier !== 'free' && (
                                <div style={{ marginTop: '10px' }}>
                                    <p style={{
                                        color: isExpiringSoon ? 'var(--danger)' : 'var(--text-muted)',
                                        fontSize: '11px',
                                        fontWeight: isExpiringSoon ? '700' : '400',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        {isExpiringSoon ? '⚠️ Expiration imminente' : 'Abonnement valide'}
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                                        Fin le {new Date(profile.subscription_expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                    </p>

                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isExpiringSoon && (
                <div style={{
                    margin: '0 20px 8px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                }}>
                    <p style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: '600' }}>
                        {daysLeft === 0 ? "Expire aujourd'hui." : `Expiration imminente: ${daysLeft} jour${(daysLeft || 0) > 1 ? 's' : ''} restants.`}
                    </p>
                    <button
                        onClick={handleRenew}
                        disabled={isRenewing}
                        style={{
                            padding: '7px 10px',
                            background: isRenewing ? 'rgba(var(--text-primary-rgb), 0.05)' : 'rgba(var(--danger-rgb), 0.2)',
                            border: '1px solid rgba(var(--danger-rgb), 0.5)',
                            borderRadius: '8px',
                            color: 'var(--danger)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: isRenewing ? 'default' : 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {isRenewing ? '...' : 'Renouveler'}
                    </button>
                </div>
            )}


            <div style={{
                margin: '0 20px 10px',
                padding: '10px 16px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '0.5px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}>
                <span style={{ fontSize: '14px' }}>📊</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                    Ton bilan mensuel détaillé arrive dans <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{daysUntilMonthlyBilan} jours</span>
                </p>
            </div>

            {/* MESSAGE PRO (creneaux) : pas de génération ni affichage bilan */}
            {effectiveTier === 'pro' && activeSlot && activeSlot !== 'diner' && (
                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', margin: '0 20px 20px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>
                        📌 Bilan de journée disponible à 23h00 dans cette section Profil.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', marginBottom: '12px' }}>
                        En plan Pro, tu reçois un bilan Coach Yao de fin de journée. Pour un bilan à chaque créneau, passe au Premium.
                    </p>
                    <div
                        onClick={() => router.push('/upgrade')}
                        style={{ display: 'inline-block', padding: '8px 12px', background: 'rgba(var(--accent-rgb), 0.15)', border: '0.5px solid rgba(var(--accent-rgb), 0.35)', borderRadius: '10px', color: 'var(--accent)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                        Passer au Premium →
                    </div>
                </div>
            )}

            {/* SECTION BILAN COACH YAO (uniquement quand le plan y a droit) */}
            {canUseAIBilanForActiveSlot && (bilanStatus === 'loading' || bilanStatus === 'done' || bilanStatus === 'empty') && (
                <div style={{ background: 'var(--bg-secondary)', border: `0.5px solid ${bilanStatus === 'loading' ? 'var(--border-color)' : (bilanColor + '40')}`, borderRadius: '16px', padding: '16px', margin: '0 20px 20px', position: 'relative', overflow: 'hidden' }}>
                    {bilanStatus === 'done' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: bilanColor }} />}

                    {bilanStatus === 'loading' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(var(--accent-rgb), 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⏳</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Génération du bilan...</p>
                        </div>
                    )}

                    {(bilanStatus === 'done' || bilanStatus === 'empty') && (
                        <>
                            {/* TITRE ET ÉMOJI */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${bilanColor}15`, border: `0.5px solid ${bilanColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{bilanEmoji}</div>
                                <div>
                                    <p style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>{bilanTitle}</p>
                                    <p style={{ color: bilanColor, fontSize: '11px', marginTop: '1px' }}>{activeSlot === 'diner' ? 'Résumé de la journée' : `Créneau ${SLOT_LABELS[activeSlot]}`}</p>
                                </div>
                            </div>

                            {/* CONTENU SI BILAN DISPONIBLE */}
                            {bilanStatus === 'done' && (
                                <>
                                    {checkPermission(profile, 'hasCoachYao') ? (
                                        bilanMessage && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px', borderLeft: `2px solid ${bilanColor}40`, paddingLeft: '12px' }}>{bilanMessage}</p>
                                    ) : (
                                        <div style={{ marginBottom: '20px' }}>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.5', marginBottom: '10px' }}>{autoMessage}</p>
                                            <div
                                                onClick={() => router.push('/upgrade')}
                                                style={{ background: 'rgba(var(--warning-rgb), 0.05)', borderRadius: '12px', padding: '12px', border: '0.5px dashed rgba(var(--warning-rgb), 0.3)', cursor: 'pointer' }}>
                                                <p style={{ color: 'var(--warning)', fontSize: '11px', lineHeight: '1.5', fontWeight: '500', marginBottom: '8px' }}>
                                                    {yaoNudge}
                                                </p>
                                                <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                    PASSEZ À PREMIUM POUR DÉCOUVRIR COACH YAO →
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {activeSlot === 'diner' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {stats.map(stat => (
                                                <div key={stat.label} style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '10px', border: `0.5px solid ${stat.color}15` }}>
                                                    <p style={{ color: stat.color, fontSize: '16px', fontWeight: '600' }}>{Math.round(stat.current)}<span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '400' }}> / {stat.target}{stat.unit}</span></p>
                                                    <div style={{ width: '100%', height: '3px', background: 'var(--bg-tertiary)', borderRadius: '2px', margin: '6px 0 4px' }}>
                                                        <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(100, Math.round((stat.current / stat.target) * 100))}%`, background: stat.color }} />
                                                    </div>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{stat.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        slots[activeSlot] && (
                                            <div style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `0.5px solid ${bilanColor}15` }}>
                                                <div>
                                                    <p style={{ color: bilanColor, fontSize: '17px', fontWeight: '700' }}>{Math.round(slots[activeSlot].consumed)}<span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '400' }}> / {slots[activeSlot].target} kcal</span></p>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>Calories {SLOT_LABELS[activeSlot]}</p>
                                                </div>
                                                <div style={{ width: '70px', height: '3px', background: 'var(--bg-tertiary)', borderRadius: '2px' }}>
                                                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(100, Math.round((slots[activeSlot].consumed / slots[activeSlot].target) * 100))}%`, background: bilanColor }} />
                                                </div>
                                            </div>
                                        )
                                    )}
                                </>
                            )}

                            {/* SI VIDE */}
                            {bilanStatus === 'empty' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(var(--text-primary-rgb), 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🍽️</div>
                                    <div>
                                        <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>Aucun repas détecté</p>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Scannez vos plats pour voir le bilan {SLOT_LABELS[activeSlot]}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* UPSELL POUR LES GENS EN FREE (Bilan Verrouillé) */}
            {effectiveTier === 'free' && (
                <div
                    onClick={() => router.push('/upgrade')}
                    style={{
                        margin: '0 20px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: '24px', padding: '24px', overflow: 'hidden', cursor: 'pointer',
                        position: 'relative'
                    }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🔒</div>
                        <div>
                            <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '16px' }}>Bilan de ta journée</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Par Coach Yao</p>
                        </div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                        Coach Yao analyse tes repas et tes macros pour te donner un bilan précis de ta journée. Débloque le plan Pro pour y accéder !
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: '800', fontSize: '12px', letterSpacing: '0.5px' }}>
                        DÉCOUVRIR LE PLAN PRO <span style={{ fontSize: '16px' }}>→</span>
                    </div>
                </div>
            )}



            <div style={{ padding: '0 20px' }}>

                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Aujourd'hui</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    {stats.map((stat) => (
                        <div key={stat.label} style={{ background: 'var(--bg-secondary)', border: `0.5px solid var(--border-color)`, borderRadius: '14px', padding: '14px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: stat.color }} />
                            <p style={{ color: stat.color, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                                {Math.round(stat.current)}<span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '400', marginLeft: '3px' }}>{stat.unit}</span>
                            </p>
                            <div style={{ width: '100%', height: '3px', background: 'var(--bg-tertiary)', borderRadius: '2px', margin: '8px 0 6px' }}>
                                <div style={{ height: '100%', borderRadius: '2px', width: `${getProgressPercent(stat.current, stat.target)}%`, background: stat.color, transition: 'width 0.5s ease' }} />
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{stat.label} · {stat.target}{stat.unit}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleShareWhatsApp}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: '#25D366', // Vert WhatsApp
                        color: '#fff',
                        borderRadius: '14px',
                        border: 'none',
                        fontWeight: '700',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        marginBottom: '28px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(37,211,102,0.2)',
                    }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                    Partager mon bilan sur WhatsApp
                </button>


                {/* NOUVEAU MENU (Paramètres, Notifications, etc.) */}
                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', marginTop: '32px', marginBottom: '24px' }}>
                    <button onClick={() => router.push('/settings')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-color)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <Settings size={20} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>Paramètres</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" strokeWidth={2} />
                    </button>

                    <button onClick={() => router.push('/notifications')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-color)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <Bell size={20} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>Notifications</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" strokeWidth={2} />
                    </button>

                    <button onClick={() => setShowSupportModal(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-color)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <HelpCircle size={20} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>Aide & Support</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" strokeWidth={2} />
                    </button>

                    <button onClick={handleLogoutTrigger} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <LogOut size={20} color="var(--danger)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--danger)', fontSize: '15px', fontWeight: '600' }}>Déconnexion</span>
                        </div>
                        <ChevronRight size={18} color="var(--danger)" strokeWidth={2} />
                    </button>
                </div>

                {/* LÉGAL */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', marginTop: '16px' }}>Légal</p>
                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', marginBottom: '32px' }}>
                    <button onClick={() => router.push('/privacy')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-color)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <Shield size={18} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>Confidentialité</span>
                        </div>
                        <ChevronRight size={16} color="var(--text-muted)" />
                    </button>
                    <button onClick={() => router.push('/terms')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <FileText size={18} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>Conditions d'utilisation</span>
                        </div>
                        <ChevronRight size={16} color="var(--text-muted)" />
                    </button>
                </div>

                {/* FOOTER */}
                <div style={{ textAlign: 'center', marginTop: '16px', marginBottom: '32px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>Cal Afrik v1.0.0</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', opacity: 0.5 }}>© 2026 Nutrition africaine</p>
                </div>

            </div>

            {/* MODAL DE SUPPORT */}
            <AnimatePresence>
                {showSupportModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowSupportModal(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                width: '100%',
                                maxWidth: '340px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '28px',
                                padding: '32px 24px',
                                border: '0.5px solid var(--border-color)',
                                textAlign: 'center',
                                position: 'relative',
                                zIndex: 3001,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 20px' }}>🎧</div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Besoin d'aide ?</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '28px' }}>
                                Par quel canal préfères-tu échanger avec notre équipe ?
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={() => { window.open('https://wa.me/22891625978?text=Bonjour%20Coach%20Yao,%20j\'ai%20besoin%20d\'aide%20sur%20l\'application%20Cal-Afrik', '_blank'); setShowSupportModal(false) }}
                                    style={{ width: '100%', padding: '16px', background: '#25D366', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                                    WhatsApp
                                </button>

                                <button
                                    onClick={() => setShowSupportModal(false)}
                                    style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' }}
                                >
                                    Annuler
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL DE CONFIRMATION DE DÉCONNEXION */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLogoutConfirm(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                width: '100%',
                                maxWidth: '340px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '28px',
                                padding: '32px 24px',
                                border: '0.5px solid var(--border-color)',
                                textAlign: 'center',
                                position: 'relative',
                                zIndex: 3001,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(var(--danger-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 20px' }}>👋</div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Déconnexion ?</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '28px' }}>
                                Es-tu sûr de vouloir te déconnecter de ton coach Yao ?
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={confirmLogout}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        background: 'var(--danger)',
                                        borderRadius: '16px',
                                        color: '#fff',
                                        border: 'none',
                                        fontSize: '15px',
                                        fontWeight: '800',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Oui, me déconnecter
                                </button>
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        background: 'transparent',
                                        color: 'var(--text-muted)',
                                        border: 'none',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Annuler
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}