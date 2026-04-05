import { create } from 'zustand'
import type { UserProfile, Meal, ScanResult } from '@/types'

type MealKey = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation'

const calculateInitialTargets = (calories: number): Record<MealKey, number> => ({
    petit_dejeuner: Math.round(calories * 0.25),
    dejeuner: Math.round(calories * 0.35),
    diner: Math.round(calories * 0.30),
    collation: Math.round(calories * 0.10),
})

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

    // ✅ Bilan fin de journée
    bilanSeenDate: string | null
    setBilanSeenDate: (date: string) => void

    dailyCalories: number
    dailyProtein: number
    dailyCarbs: number
    dailyFat: number
    updateDailyTotals: () => void

    mealTargets: Record<MealKey, number>
    lockedMealTargets: Partial<Record<MealKey, number>>
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

    setProfile: (profile) => {
        if (!profile) return set({ profile })
        set({
            profile,
            mealTargets: calculateInitialTargets(profile.calorie_target),
            lockedMealTargets: {}
        })
    },

    todayMeals: [],

    setTodayMeals: (meals) => {
        set({ todayMeals: meals })
        get().updateDailyTotals()
        get().recalculateMealTargets()
    },

    addMeal: (meal) => {
        const state = get()
        const mealType = meal.meal_type as MealKey

        if (!state.lockedMealTargets[mealType]) {
            set({
                lockedMealTargets: {
                    ...state.lockedMealTargets,
                    [mealType]: state.mealTargets[mealType]
                }
            })
        }

        set((state) => ({ todayMeals: [...state.todayMeals, meal] }))
        get().updateDailyTotals()
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

    bilanSeenDate: null,
    setBilanSeenDate: (date) => set({ bilanSeenDate: date }),

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

    mealTargets: calculateInitialTargets(2000),
    lockedMealTargets: {},

    recalculateMealTargets: () => {
        const { todayMeals, profile, lockedMealTargets } = get()
        if (!profile) return

        const now = new Date().getHours()

        const completedMeals: Record<MealKey, boolean> = {
            petit_dejeuner: now >= 10,
            dejeuner: now >= 16,
            collation: now >= 17,
            diner: false
        }

        const consumedCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0)
        const remainingCalories = Math.max(0, profile.calorie_target - consumedCalories)

        const remainingMeals = (Object.keys(completedMeals) as MealKey[])
            .filter(key => !completedMeals[key] && !lockedMealTargets[key])

        if (remainingMeals.length === 0) return

        const newTarget = Math.round(remainingCalories / remainingMeals.length)

        const newTargets: Record<MealKey, number> = {
            petit_dejeuner: lockedMealTargets.petit_dejeuner ?? (completedMeals.petit_dejeuner ? 0 : newTarget),
            dejeuner: lockedMealTargets.dejeuner ?? (completedMeals.dejeuner ? 0 : newTarget),
            collation: lockedMealTargets.collation ?? (completedMeals.collation ? 0 : newTarget),
            diner: lockedMealTargets.diner ?? (completedMeals.diner ? 0 : newTarget),
        }

        set({ mealTargets: newTargets })
    },
}))