import { create } from 'zustand'
import type { UserProfile, Meal, ScanResult } from '@/types'

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'

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

    dailyCalories: number
    dailyProtein: number
    dailyCarbs: number
    dailyFat: number
    updateDailyTotals: () => void

    mealTargets: {
        breakfast: number
        lunch: number
        dinner: number
        snack: number
    }

    recalculateMealTargets: () => void
}

export const useAppStore = create<AppState>((set, get) => ({

    profile: {
        id: '1',
        user_id: '1',
        name: 'Kofi Mensah',
        age: 28,
        gender: 'homme',
        weight_kg: 74,
        height_cm: 178,
        activity_level: 'modere',
        goal: 'maintenir',
        calorie_target: 2000,
        protein_target_g: 100,
        carbs_target_g: 260,
        fat_target_g: 62,
        preferred_cuisines: ['Togolaise', 'Ghanéenne'],
        dietary_restrictions: [],
        language: 'fr',
        country: 'TG',
    },

    setProfile: (profile) => set({ profile }),

    todayMeals: [],

    setTodayMeals: (meals) => {
        set({ todayMeals: meals })
        get().updateDailyTotals()
        get().recalculateMealTargets()
    },

    addMeal: (meal) => {
        set((state) => ({
            todayMeals: [...state.todayMeals, meal]
        }))

        get().updateDailyTotals()
        get().recalculateMealTargets() // 🔥 IMPORTANT
    },

    removeMeal: (mealId) => {
        set((state) => ({
            todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
        }))

        get().updateDailyTotals()
        get().recalculateMealTargets()
    },

    scanResult: null,
    setScanResult: (result) => set({ scanResult: result }),

    isScanning: false,
    setIsScanning: (v) => set({ isScanning: v }),

    lastCoachMessage: null,
    setLastCoachMessage: (msg) => set({ lastCoachMessage: msg }),

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

    // 🔥 INITIAL TARGETS
    mealTargets: {
        breakfast: 500,
        lunch: 700,
        dinner: 600,
        snack: 200,
    },

    // 🔥 CŒUR DU SYSTEME
    recalculateMealTargets: () => {
        const { todayMeals, profile } = get()

        if (!profile) return

        const totalGoal = profile.calorie_target

        // 🔥 total consommé
        const totalConsumed = todayMeals.reduce((sum, m) => sum + m.calories, 0)

        const remainingCalories = Math.max(0, totalGoal - totalConsumed)

        // 🔥 repas déjà faits (on suppose meal.type existe)
        const completedMeals: Record<MealKey, boolean> = {
            breakfast: false,
            lunch: false,
            dinner: false,
            snack: false
        }

        todayMeals.forEach((meal) => {
            const type = meal.meal_type as MealKey
            if (type && completedMeals[type] !== undefined) {
                completedMeals[type] = true
            }
        })

        // 🔥 repas restants
        const remainingMealKeys = Object.keys(completedMeals).filter(
            (k) => !completedMeals[k as keyof typeof completedMeals]
        )

        // 🔥 si tout est consommé → reset à 0
        if (remainingMealKeys.length === 0) {
            set({
                mealTargets: {
                    breakfast: 0,
                    lunch: 0,
                    dinner: 0,
                    snack: 0,
                }
            })
            return
        }

        // 🔥 redistribution intelligente
        const newTarget = Math.round(remainingCalories / remainingMealKeys.length)

        const newTargets = {
            breakfast: completedMeals.breakfast ? 0 : newTarget,
            lunch: completedMeals.lunch ? 0 : newTarget,
            dinner: completedMeals.dinner ? 0 : newTarget,
            snack: completedMeals.snack ? 0 : newTarget,
        }

        set({ mealTargets: newTargets })
    },
}))