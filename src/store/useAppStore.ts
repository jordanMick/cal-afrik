import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, Meal, ScanResult } from '@/types'

export type MealSlotKey = 'petit_dejeuner' | 'dejeuner' | 'collation' | 'diner'

// ─── Déterminer le créneau selon l'heure ─────────────────────
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

// Ordre des créneaux dans la journée
const SLOT_ORDER: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']

interface SlotState {
    target: number
    consumed: number
    remaining: number
    locked: boolean
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

    bilanSeenDate: string | null
    setBilanSeenDate: (date: string) => void

    bilanMessage: string | null
    setBilanMessage: (msg: string) => void

    bilanGoalReached: boolean
    setBilanGoalReached: (v: boolean) => void

    bilanExceeded: boolean
    setBilanExceeded: (v: boolean) => void

    // ─── Slots nutritionnels ─────────────────────────────────
    slots: Record<MealSlotKey, SlotState>
    initSlots: (calorieTarget: number) => void
    updateSlotOnAdd: (slot: MealSlotKey, calories: number) => void
    updateSlotOnRemove: (slot: MealSlotKey, calories: number) => void
    redistributeAfterSlot: (finishedSlot: MealSlotKey) => void

    // Totaux du jour
    dailyCalories: number
    dailyProtein: number
    dailyCarbs: number
    dailyFat: number
    updateDailyTotals: () => void
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
                if (!profile) return set({ profile })
                set({
                    profile,
                    slots: buildInitialSlots(profile.calorie_target),
                })
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
                }
            },

            updateSlotOnAdd: (slot, calories) => {
                set((state) => {
                    const current = state.slots[slot]
                    const newConsumed = current.consumed + calories
                    const newRemaining = current.target - newConsumed
                    return {
                        slots: {
                            ...state.slots,
                            [slot]: {
                                ...current,
                                consumed: newConsumed,
                                remaining: newRemaining,
                            }
                        }
                    }
                })
            },

            updateSlotOnRemove: (slot, calories) => {
                set((state) => {
                    const current = state.slots[slot]
                    const newConsumed = Math.max(0, current.consumed - calories)
                    const newRemaining = current.target - newConsumed
                    return {
                        slots: {
                            ...state.slots,
                            [slot]: {
                                ...current,
                                consumed: newConsumed,
                                remaining: newRemaining,
                            }
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

            bilanSeenDate: null,
            setBilanSeenDate: (date) => set({ bilanSeenDate: date }),

            bilanMessage: null,
            setBilanMessage: (msg) => set({ bilanMessage: msg }),

            bilanGoalReached: false,
            setBilanGoalReached: (v) => set({ bilanGoalReached: v }),

            bilanExceeded: false,
            setBilanExceeded: (v) => set({ bilanExceeded: v }),

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
        }),
        {
            name: 'app-storage',
            partialize: (state) => ({
                bilanSeenDate: state.bilanSeenDate,
                bilanMessage: state.bilanMessage,
                bilanGoalReached: state.bilanGoalReached,
                bilanExceeded: state.bilanExceeded,
            }),
        }
    )
)