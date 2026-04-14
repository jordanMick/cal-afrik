import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, Meal, ScanResult } from '@/types'

export type MealSlotKey = 'petit_dejeuner' | 'dejeuner' | 'collation' | 'diner'

export function getMealSlot(hour: number): MealSlotKey {
    if (hour >= 0 && hour < 12) return 'petit_dejeuner'
    if (hour >= 12 && hour < 16) return 'dejeuner'
    if (hour >= 16 && hour < 19) return 'collation'
    return 'diner'
}

export const SLOT_LABELS: Record<MealSlotKey, string> = {
    petit_dejeuner: 'Petit-déjeuner',
    dejeuner: 'Déjeuner',
    collation: 'Collation',
    diner: 'Dîner',
}

export const SLOT_PCT: Record<MealSlotKey, number> = {
    petit_dejeuner: 0.25,
    dejeuner: 0.35,
    collation: 0.10,
    diner: 0.30,
}

// Créneau suivant pour les conseils
export const NEXT_SLOT: Partial<Record<MealSlotKey, MealSlotKey>> = {
    petit_dejeuner: 'dejeuner',
    dejeuner: 'collation',
    collation: 'diner',
}

// Heure à partir de laquelle le bilan du créneau est disponible
export const SLOT_BILAN_HOUR: Record<MealSlotKey, number> = {
    petit_dejeuner: 12,
    dejeuner: 16,
    collation: 19,
    diner: 23,
}

const SLOT_ORDER: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']

interface SlotState {
    target: number
    consumed: number
    remaining: number

    // Macros par slot
    protein_target: number
    protein_consumed: number
    carbs_target: number
    carbs_consumed: number
    fat_target: number
    fat_consumed: number

    locked: boolean
}

// Cache d'un bilan par créneau
export interface SlotBilan {
    message: string
    goalReached: boolean
    exceeded: boolean
    date: string // YYYY-MM-DD pour savoir si c'est encore valide
    needsRefresh: boolean
}

interface AppState {
    profile: UserProfile | null
    setProfile: (profile: UserProfile | null) => void

    todayMeals: Meal[]
    setTodayMeals: (meals: Meal[]) => void
    addMeal: (meal: Meal) => void
    removeMeal: (mealId: string) => void

    scanResult: ScanResult | null
    setScanResult: (result: ScanResult | null) => void
    isScanning: boolean
    setIsScanning: (v: boolean) => void

    lastCoachMessage: string | null
    setLastCoachMessage: (msg: string) => void
    chatSuggestedMenus: {
        today: Record<string, string | null> // slot -> message
        tomorrow: string | null
        week: string | null
        date: string | null // YYYY-MM-DD
        user_id: string | null
    }
    setChatSuggestedMenu: (kind: 'today' | 'tomorrow' | 'week', message: string, slot?: string) => void
    clearChatSuggestedMenu: (kind: 'today' | 'tomorrow' | 'week', slot?: string) => void

    // ─── Bilans par créneau ──────────────────────────────────
    slotBilans: Partial<Record<MealSlotKey, SlotBilan>>
    setSlotBilan: (slot: MealSlotKey, bilan: SlotBilan) => void
    markSlotNeedsRefresh: (slot: MealSlotKey) => void

    // ─── Slots nutritionnels ─────────────────────────────────
    slots: Record<MealSlotKey, SlotState>
    initSlots: (calorieTarget: number, proteinTarget: number, carbsTarget: number, fatTarget: number) => void
    syncSlots: () => void
    redistributeAfterSlot: (finishedSlot: MealSlotKey) => void

    dailyCalories: number
    dailyProtein: number
    dailyCarbs: number
    dailyFat: number
    updateDailyTotals: () => void

    // ─── Onboarding ──────────────────────────────────────────
    onboardingStep: number
    setOnboardingStep: (step: number) => void
    onboardingForm: any
    setOnboardingForm: (form: any) => void

    dailyReview: {
        emoji: string
        text: string
        date: string
    } | null
    setDailyReview: (review: { emoji: string, text: string, date: string } | null) => void

    // ─── Pont Coach → Scanner ─────────────────────────────────
    pendingScannerPrefill: {
        items: Array<{ name: string; volume_ml: number }>
        slot: string
    } | null
    setPendingScannerPrefill: (data: { items: Array<{ name: string; volume_ml: number }>; slot: string } | null) => void

    // ─── Distributions Macros (Premium) ────────────────────────
    macroDistributions: Record<string, Record<MealSlotKey, number>>
    updateMacroDistribution: (nutrient: string, slot: MealSlotKey, pct: number) => void
}

const DEFAULT_DIST: Record<MealSlotKey, number> = {
    petit_dejeuner: 0.25,
    dejeuner: 0.35,
    collation: 0.10,
    diner: 0.30,
}

const buildInitialSlots = (cal: number, prot: number, carbs: number, fat: number, dists?: Record<string, Record<MealSlotKey, number>>): Record<MealSlotKey, SlotState> => {
    const res = {} as Record<MealSlotKey, SlotState>
    const d = dists || { calories: DEFAULT_DIST, protein: DEFAULT_DIST, carbs: DEFAULT_DIST, fat: DEFAULT_DIST }
    
    for (const key of SLOT_ORDER) {
        res[key] = {
            target: Math.round(cal * (d.calories?.[key] ?? DEFAULT_DIST[key])),
            consumed: 0,
            remaining: Math.round(cal * (d.calories?.[key] ?? DEFAULT_DIST[key])),
            protein_target: Math.round(prot * (d.protein?.[key] ?? DEFAULT_DIST[key])),
            protein_consumed: 0,
            carbs_target: Math.round(carbs * (d.carbs?.[key] ?? DEFAULT_DIST[key])),
            carbs_consumed: 0,
            fat_target: Math.round(fat * (d.fat?.[key] ?? DEFAULT_DIST[key])),
            fat_consumed: 0,
            locked: false
        }
    }
    return res
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            profile: null,
            setProfile: (profile) => {
                if (!profile) return set({ profile: null })
                
                const currentProfile = get().profile
                const newUserId = profile.user_id || profile.id
                const oldUserId = currentProfile?.user_id || currentProfile?.id

                // Si l'utilisateur change, on vide les données locales sensibles
                if (newUserId && oldUserId && newUserId !== oldUserId) {
                    set({
                        todayMeals: [],
                        chatSuggestedMenus: { today: {}, tomorrow: null, week: null, date: null, user_id: null },
                        dailyReview: null,
                        slotBilans: {},
                    })
                }

                set({ profile })
                // Déclencher un refresh des repas pour recalculer les slots avec le nouveau profil
                if (get().todayMeals.length > 0) {
                    get().setTodayMeals(get().todayMeals)
                } else {
                    set({ 
                        slots: buildInitialSlots(
                            profile.calorie_target, 
                            profile.protein_target_g || 100, 
                            profile.carbs_target_g || 250, 
                            profile.fat_target_g || 65,
                            get().macroDistributions
                        ) 
                    })
                }
            },

            todayMeals: [],

            setTodayMeals: (meals) => {
                set({ todayMeals: meals })
                get().updateDailyTotals()
                get().syncSlots()
            },

            syncSlots: () => {
                const { todayMeals, profile, macroDistributions } = get()
                if (!profile) return

                const calorieTarget = profile.calorie_target
                const protTarget = profile.protein_target_g || 100
                const carbsTarget = profile.carbs_target_g || 250
                const fatTarget = profile.fat_target_g || 65

                let newSlots = buildInitialSlots(calorieTarget, protTarget, carbsTarget, fatTarget, macroDistributions)
                
                // 1. Calculer les consommations par créneau
                for (const meal of todayMeals) {
                    const hour = new Date(meal.logged_at).getHours()
                    const slot = getMealSlot(hour)
                    newSlots[slot].consumed += meal.calories
                    newSlots[slot].protein_consumed += meal.protein_g
                    newSlots[slot].carbs_consumed += meal.carbs_g
                    newSlots[slot].fat_consumed += meal.fat_g
                }

                // 2. Redistribution adaptative
                const currentHour = new Date().getHours()
                const currentSlot = getMealSlot(currentHour)
                const currentIdx = SLOT_ORDER.indexOf(currentSlot)

                let consCalPast = 0
                let consProtPast = 0
                let consCarbsPast = 0
                let consFatPast = 0

                for (let i = 0; i < currentIdx; i++) {
                    const s = SLOT_ORDER[i]
                    consCalPast += newSlots[s].consumed
                    consProtPast += newSlots[s].protein_consumed
                    consCarbsPast += newSlots[s].carbs_consumed
                    consFatPast += newSlots[s].fat_consumed
                    newSlots[s].locked = true
                }

                const remCal = Math.max(0, calorieTarget - consCalPast)
                const remProt = Math.max(0, protTarget - consProtPast)
                const remCarbs = Math.max(0, carbsTarget - consCarbsPast)
                const remFat = Math.max(0, fatTarget - consFatPast)

                const remainingSlots = SLOT_ORDER.slice(currentIdx)
                
                // On utilise les distributions personnalisées
                const d = macroDistributions
                const totalPctRemCal = remainingSlots.reduce((sum, s) => sum + (d.calories?.[s] ?? DEFAULT_DIST[s]), 0)
                const totalPctRemProt = remainingSlots.reduce((sum, s) => sum + (d.protein?.[s] ?? DEFAULT_DIST[s]), 0)
                const totalPctRemCarbs = remainingSlots.reduce((sum, s) => sum + (d.carbs?.[s] ?? DEFAULT_DIST[s]), 0)
                const totalPctRemFat = remainingSlots.reduce((sum, s) => sum + (d.fat?.[s] ?? DEFAULT_DIST[s]), 0)

                for (const slotKey of remainingSlots) {
                    const shareCal = (d.calories?.[slotKey] ?? DEFAULT_DIST[slotKey]) / (totalPctRemCal || 1)
                    newSlots[slotKey].target = Math.round(remCal * shareCal)
                    newSlots[slotKey].remaining = Math.max(0, newSlots[slotKey].target - newSlots[slotKey].consumed)
                    
                    const shareProt = (d.protein?.[slotKey] ?? DEFAULT_DIST[slotKey]) / (totalPctRemProt || 1)
                    newSlots[slotKey].protein_target = Math.round(remProt * shareProt)

                    const shareCarbs = (d.carbs?.[slotKey] ?? DEFAULT_DIST[slotKey]) / (totalPctRemCarbs || 1)
                    newSlots[slotKey].carbs_target = Math.round(remCarbs * shareCarbs)

                    const shareFat = (d.fat?.[slotKey] ?? DEFAULT_DIST[slotKey]) / (totalPctRemFat || 1)
                    newSlots[slotKey].fat_target = Math.round(remFat * shareFat)
                }

                set({ slots: newSlots })
            },

            macroDistributions: {
                calories: DEFAULT_DIST,
                protein: DEFAULT_DIST,
                carbs: DEFAULT_DIST,
                fat: DEFAULT_DIST,
            },

            updateMacroDistribution: (nutrient, slot, pct) => {
                set((state) => {
                    const nutrientDist = { ...state.macroDistributions[nutrient], [slot]: pct }
                    return {
                        macroDistributions: { ...state.macroDistributions, [nutrient]: nutrientDist }
                    }
                })
                get().syncSlots()
            },

            addMeal: (meal) => {
                set((state) => ({ todayMeals: [...state.todayMeals, meal] }))
                get().updateDailyTotals()
                get().syncSlots()

                // Invalider le bilan
                const hour = new Date(meal.logged_at).getHours()
                const slot = getMealSlot(hour)
                const slotIndex = SLOT_ORDER.indexOf(slot)
                const slotsToInvalidate = SLOT_ORDER.slice(slotIndex)
                slotsToInvalidate.forEach(s => get().markSlotNeedsRefresh(s))
            },

            removeMeal: (mealId) => {
                const meal = get().todayMeals.find(m => m.id === mealId)
                if (!meal) return

                set((state) => ({
                    todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
                }))
                get().updateDailyTotals()
                get().syncSlots()

                const hour = new Date(meal.logged_at).getHours()
                const slot = getMealSlot(hour)
                const slotIndex = SLOT_ORDER.indexOf(slot)
                const slotsToInvalidate = SLOT_ORDER.slice(slotIndex)
                slotsToInvalidate.forEach(s => get().markSlotNeedsRefresh(s))
            },

            redistributeAfterSlot: (finishedSlot) => {
                get().syncSlots()
            },

            scanResult: null,
            setScanResult: (result) => set({ scanResult: result }),
            isScanning: false,
            setIsScanning: (v) => set({ isScanning: v }),

            lastCoachMessage: null,
            setLastCoachMessage: (msg) => set({ lastCoachMessage: msg }),
            chatSuggestedMenus: {
                today: {},
                tomorrow: null,
                week: null,
                date: null,
                user_id: null,
            },
            setChatSuggestedMenu: (kind, message, slot) =>
                set((state) => {
                    const today = new Date().toISOString().split('T')[0]
                    const nextToday = { ...state.chatSuggestedMenus.today }
                    if (kind === 'today' && slot) {
                        nextToday[slot] = message
                    } else if (kind === 'today') {
                        const slotMatch = message.match(/menu creneau (petit_dejeuner|dejeuner|collation|diner):/i)
                        const s = slotMatch ? (slotMatch[1] as MealSlotKey) : 'unspecified' as any
                        nextToday[s] = message
                    }

                    const userId = get().profile?.user_id || get().profile?.id || null

                    return {
                        chatSuggestedMenus: {
                            ...state.chatSuggestedMenus,
                            today: nextToday,
                            tomorrow: kind === 'tomorrow' ? message : state.chatSuggestedMenus.tomorrow,
                            week: kind === 'week' ? message : state.chatSuggestedMenus.week,
                            date: today,
                            user_id: userId
                        },
                    }
                }),

            clearChatSuggestedMenu: (kind, slot) =>
                set((state) => {
                    const nextToday = { ...state.chatSuggestedMenus.today }
                    if (kind === 'today' && slot) {
                        delete nextToday[slot]
                    }
                    return {
                        chatSuggestedMenus: {
                            ...state.chatSuggestedMenus,
                            today: nextToday,
                            tomorrow: kind === 'tomorrow' ? null : state.chatSuggestedMenus.tomorrow,
                            week: kind === 'week' ? null : state.chatSuggestedMenus.week,
                        }
                    }
                }),

            dailyReview: null,
            setDailyReview: (review) => set({ dailyReview: review }),

            slotBilans: {},
            setSlotBilan: (slot, bilan) =>
                set((state) => ({
                    slotBilans: { ...state.slotBilans, [slot]: bilan }
                })),
            markSlotNeedsRefresh: (slot) =>
                set((state) => {
                    const existing = state.slotBilans[slot]
                    if (!existing) return state
                    return {
                        slotBilans: {
                            ...state.slotBilans,
                            [slot]: { ...existing, needsRefresh: true }
                        }
                    }
                }),

            dailyCalories: 0,
            dailyProtein: 0,
            dailyCarbs: 0,
            dailyFat: 0,

            updateDailyTotals: () => {
                const meals = get().todayMeals
                const totals = meals.reduce(
                    (acc, m) => ({
                        dailyCalories: acc.dailyCalories + m.calories,
                        dailyProtein: acc.dailyProtein + m.protein_g,
                        dailyCarbs: acc.dailyCarbs + m.carbs_g,
                        dailyFat: acc.dailyFat + m.fat_g,
                    }),
                    { dailyCalories: 0, dailyProtein: 0, dailyCarbs: 0, dailyFat: 0 }
                )
                set(totals)
            },

            initSlots: (cal, prot, carbs, fat) => {
                set({ slots: buildInitialSlots(cal, prot, carbs, fat, get().macroDistributions) })
            },

            slots: buildInitialSlots(2000, 100, 250, 65, { calories: DEFAULT_DIST, protein: DEFAULT_DIST, carbs: DEFAULT_DIST, fat: DEFAULT_DIST }),

            onboardingStep: 0,
            setOnboardingStep: (step) => set({ onboardingStep: step }),
            onboardingForm: null,
            setOnboardingForm: (form) => set({ onboardingForm: form }),

            pendingScannerPrefill: null,
            setPendingScannerPrefill: (data) => set({ pendingScannerPrefill: data }),
        }),
        {
            name: 'app-storage',
            partialize: (state) => ({
                slots: state.slots,
                todayMeals: state.todayMeals,
                slotBilans: state.slotBilans,
                onboardingStep: state.onboardingStep,
                onboardingForm: state.onboardingForm,
                chatSuggestedMenus: state.chatSuggestedMenus,
                macroDistributions: state.macroDistributions,
            }),
        }
    )
)