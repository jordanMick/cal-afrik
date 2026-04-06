import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { getProgressPercent } from '@/lib/nutrition'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
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
        <div className="flex flex-col min-h-screen bg-black text-white p-6 pb-32 relative overflow-hidden">
            {/* Halos Cal AI */}
            <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute top-[20%] left-[-10%] w-[200px] h-[200px] rounded-full bg-green-500/5 blur-[100px] pointer-events-none" />

            {/* HEADER ÉLITE */}
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        🌍
                    </div>
                    <span className="text-xl font-black tracking-tight">Cal Afrik</span>
                </div>
                <button 
                  onClick={() => router.push('/profil')}
                  className="w-10 h-10 rounded-full border border-white/10 bg-zinc-900 flex items-center justify-center font-bold text-xs ring-2 ring-white/5 transition-transform active:scale-90"
                >
                    {profile?.name?.[0] || 'U'}
                </button>
            </div>

            {/* FOCUS CALORIES (Style Cal AI) */}
            <div className="text-center space-y-2 mb-12">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Calories Restantes</span>
                <div className="relative inline-block">
                    <h2 className={cn(
                        "text-8xl font-black tracking-tighter tabular-nums",
                        exceeded ? "text-red-500" : "text-white"
                    )}>
                        {remaining}
                    </h2>
                    {exceeded && (
                        <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                            <span className="text-black text-lg">⚠️</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Objectif : {calorieTarget} kcal
                    </div>
                    <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                exceeded ? "bg-red-500 shadow-[0_0_10px_#ef4444]" : "bg-green-500 shadow-[0_0_10px_#22c55e]"
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* MESSAGE COACH MINI */}
            <Card className="mb-10 bg-zinc-950 border-white/5 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                    {coachMsg.emoji}
                </div>
                <p className="text-[11px] font-bold leading-relaxed text-white/50 italic tracking-tight">
                    "{coachMsg.text}"
                </p>
            </Card>

            {/* MACROS - PILL STYLE */}
            <div className="grid grid-cols-3 gap-3 mb-12">
                {macros.map((m) => {
                    const pct = Math.min(100, Math.round((m.val / m.target) * 100))
                    return (
                        <div key={m.label} className="flex flex-col gap-2">
                            <div className="glass-panel p-3 rounded-[1.8rem] flex flex-col items-center gap-1 border-white/5">
                                <span className="text-[12px] font-black text-white">{Math.round(m.val)}g</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{m.label}</span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden px-[2px] py-[1px]">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    className="h-full rounded-full" 
                                    style={{ backgroundColor: m.color }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* MEALS LIST */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-white/30">Repas d'aujourd'hui</h3>
                    <div className="h-px bg-white/5 flex-1 ml-4" />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-8 h-8 rounded-full border-2 border-white/5 border-t-white/30 animate-spin" />
                    </div>
                ) : todayMeals.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-2xl mx-auto opacity-20">🍽️</div>
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.15em]">Aucun repas enregistré</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {todayMeals.map((meal, idx) => {
                            const colors = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']
                            const color = colors[idx % colors.length]
                            return (
                                <motion.div 
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    key={meal.id} 
                                    className="glass-panel p-3 rounded-[2rem] border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors"
                                >
                                    <div className="relative shrink-0">
                                        <img 
                                          src={meal.image_url || '/placeholder.png'} 
                                          className="w-14 h-14 rounded-full object-cover ring-2 ring-white/5" 
                                        />
                                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black border-2 border-white/5 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black tracking-tight text-white truncate">{meal.custom_name || 'Repas Sans Nom'}</p>
                                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{formatTime(meal.logged_at)}</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                            <span className="text-xs font-black text-white">{Math.round(meal.calories)} </span>
                                            <span className="text-[8px] font-black text-white/20 uppercase">KCAL</span>
                                        </div>
                                        <button 
                                          onClick={() => { if (confirm('Supprimer ?')) handleDeleteMeal(meal.id) }}
                                          className="text-[9px] font-bold text-red-500/40 hover:text-red-500 uppercase tracking-tighter transition-colors px-2"
                                        >
                                            EFFACER
                                        </button>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* FAB ÉLITE */}
            <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()} 
                className="fixed bottom-32 right-6 w-16 h-16 rounded-full bg-white text-black shadow-2xl shadow-white/20 flex items-center justify-center z-[100] ring-4 ring-black"
            >
                <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-10 pointer-events-none" />
                <span className="text-3xl font-light">+</span>
            </motion.button>

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    ; (window as any).tempImage = file
                    router.push('/scanner')
                }}
            />
        </div>
    )
}