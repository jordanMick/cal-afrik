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
    initSlots: (calorieTarget: number) => void
    updateSlotOnAdd: (slot: MealSlotKey, calories: number) => void
    updateSlotOnRemove: (slot: MealSlotKey, calories: number) => void
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
}

const buildInitialSlots = (calorieTarget: number): Record<MealSlotKey, SlotState> => ({
    petit_dejeuner: { target: Math.round(calorieTarget * 0.25), consumed: 0, remaining: Math.round(calorieTarget * 0.25), locked: false },
    dejeuner: { target: Math.round(calorieTarget * 0.35), consumed: 0, remaining: Math.round(calorieTarget * 0.35), locked: false },
    collation: { target: Math.round(calorieTarget * 0.10), consumed: 0, remaining: Math.round(calorieTarget * 0.10), locked: false },
    diner: { target: Math.round(calorieTarget * 0.30), consumed: 0, remaining: Math.round(calorieTarget * 0.30), locked: false },
})

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

                set({ profile, slots: buildInitialSlots(profile.calorie_target) })
            },

            todayMeals: [],

            setTodayMeals: (meals) => {
                set({ todayMeals: meals })
                get().updateDailyTotals()

                const { profile } = get()
                if (!profile) return

                const slots = buildInitialSlots(profile.calorie_target)
                for (const meal of meals) {
                    const hour = new Date(meal.logged_at).getHours()
                    const slot = getMealSlot(hour)
                    slots[slot].consumed += meal.calories
                    slots[slot].remaining = Math.max(0, slots[slot].target - slots[slot].consumed)
                }

                const currentHour = new Date().getHours()
                const currentSlot = getMealSlot(currentHour)
                const currentIndex = SLOT_ORDER.indexOf(currentSlot)
                for (let i = 0; i < currentIndex; i++) {
                    slots[SLOT_ORDER[i]].locked = true
                }

                set({ slots })
            },

            addMeal: (meal) => {
                set((state) => ({ todayMeals: [...state.todayMeals, meal] }))
                get().updateDailyTotals()

                const hour = new Date(meal.logged_at).getHours()
                const slot = getMealSlot(hour)
                get().updateSlotOnAdd(slot, meal.calories)

                // Invalider le bilan du créneau concerné et tous les suivants
                const slotIndex = SLOT_ORDER.indexOf(slot)
                const slotsToInvalidate = SLOT_ORDER.slice(slotIndex)
                slotsToInvalidate.forEach(s => get().markSlotNeedsRefresh(s))
            },

            removeMeal: (mealId) => {
                const meal = get().todayMeals.find(m => m.id === mealId)
                set((state) => ({
                    todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
                }))
                get().updateDailyTotals()

                if (meal) {
                    const hour = new Date(meal.logged_at).getHours()
                    const slot = getMealSlot(hour)
                    get().updateSlotOnRemove(slot, meal.calories)

                    const slotIndex = SLOT_ORDER.indexOf(slot)
                    const slotsToInvalidate = SLOT_ORDER.slice(slotIndex)
                    slotsToInvalidate.forEach(s => get().markSlotNeedsRefresh(s))
                }
            },

            updateSlotOnAdd: (slot, calories) => {
                set((state) => {
                    const current = state.slots[slot]
                    const newConsumed = current.consumed + calories
                    return {
                        slots: {
                            ...state.slots,
                            [slot]: { ...current, consumed: newConsumed, remaining: current.target - newConsumed }
                        }
                    }
                })
            },

            updateSlotOnRemove: (slot, calories) => {
                set((state) => {
                    const current = state.slots[slot]
                    const newConsumed = Math.max(0, current.consumed - calories)
                    return {
                        slots: {
                            ...state.slots,
                            [slot]: { ...current, consumed: newConsumed, remaining: current.target - newConsumed }
                        }
                    }
                })
            },

            redistributeAfterSlot: (finishedSlot) => {
                const { slots, dailyCalories, profile } = get()
                if (!profile) return

                const calorieTarget = profile.calorie_target
                const finishedIndex = SLOT_ORDER.indexOf(finishedSlot)
                const remainingSlots = SLOT_ORDER.slice(finishedIndex + 1)
                if (remainingSlots.length === 0) return

                const remainingCalories = Math.max(0, calorieTarget - dailyCalories)
                const totalRemainingPct = remainingSlots.reduce((sum, s) => sum + SLOT_PCT[s], 0)

                const newSlots = { ...slots }
                newSlots[finishedSlot] = { ...newSlots[finishedSlot], locked: true }

                for (const slot of remainingSlots) {
                    const pctShare = SLOT_PCT[slot] / totalRemainingPct
                    const newTarget = Math.round(remainingCalories * pctShare)
                    newSlots[slot] = {
                        ...newSlots[slot],
                        target: newTarget,
                        remaining: Math.max(0, newTarget - newSlots[slot].consumed),
                    }
                }

                set({ slots: newSlots })
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

            initSlots: (calorieTarget) => {
                set({ slots: buildInitialSlots(calorieTarget) })
            },

            slots: buildInitialSlots(2000),

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
                slotBilans: state.slotBilans,
                onboardingStep: state.onboardingStep,
                onboardingForm: state.onboardingForm,
                chatSuggestedMenus: state.chatSuggestedMenus,
            }),
        }
    )
)