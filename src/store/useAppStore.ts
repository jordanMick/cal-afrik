import { create } from 'zustand'
import type { UserProfile, Meal, ScanResult } from '@/types'

interface AppState {
    // Profil
    profile: UserProfile | null
    setProfile: (profile: UserProfile | null) => void

    // Journal du jour
    todayMeals: Meal[]
    setTodayMeals: (meals: Meal[]) => void
    addMeal: (meal: Meal) => void
    removeMeal: (mealId: string) => void

    // Scanner
    scanResult: ScanResult | null
    setScanResult: (result: ScanResult | null) => void
    isScanning: boolean
    setIsScanning: (v: boolean) => void

    // Totaux du jour
    dailyCalories: number
    dailyProtein: number
    dailyCarbs: number
    dailyFat: number
    updateDailyTotals: () => void
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
    },
    addMeal: (meal) => {
        set((state) => ({ todayMeals: [...state.todayMeals, meal] }))
        get().updateDailyTotals()
    },
    removeMeal: (mealId) => {
        set((state) => ({
            todayMeals: state.todayMeals.filter((m) => m.id !== mealId),
        }))
        get().updateDailyTotals()
    },

    scanResult: null,
    setScanResult: (result) => set({ scanResult: result }),
    isScanning: false,
    setIsScanning: (v) => set({ isScanning: v }),

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
}))