import type { CalorieCalculationInput, UserProfile } from '@/types'

export function calculateCalorieTarget(input: CalorieCalculationInput): {
    calorie_target: number
    protein_target_g: number
    carbs_target_g: number
    fat_target_g: number
} {
    const { age, gender, weight_kg, height_cm, activity_level, goal } = input

    let bmr: number
    if (gender === 'homme') {
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    } else {
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    }

    const activityFactors = {
        sedentaire: 1.2,
        leger: 1.375,
        modere: 1.55,
        actif: 1.725,
        tres_actif: 1.9,
    }
    const tdee = bmr * activityFactors[activity_level]

    const goalAdjustments = {
        perdre: -400,
        maintenir: 0,
        prendre: +300,
    }
    const calorie_target = Math.round(tdee + goalAdjustments[goal])

    const protein_target_g = Math.round((calorie_target * 0.20) / 4)
    const fat_target_g = Math.round((calorie_target * 0.28) / 9)
    const carbs_target_g = Math.round((calorie_target * 0.52) / 4)

    return { calorie_target, protein_target_g, carbs_target_g, fat_target_g }
}

export function calculateMealCalories(
    calories_per_100g: number,
    portion_g: number
): number {
    return Math.round((calories_per_100g * portion_g) / 100)
}

export function calculateMealMacros(
    food: { protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number },
    portion_g: number
) {
    return {
        protein_g: Math.round((food.protein_per_100g * portion_g) / 100 * 10) / 10,
        carbs_g: Math.round((food.carbs_per_100g * portion_g) / 100 * 10) / 10,
        fat_g: Math.round((food.fat_per_100g * portion_g) / 100 * 10) / 10,
    }
}

export function calculateDailyTotals(meals: Array<{
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
}>) {
    return meals.reduce(
        (acc, meal) => ({
            calories: acc.calories + meal.calories,
            protein_g: acc.protein_g + meal.protein_g,
            carbs_g: acc.carbs_g + meal.carbs_g,
            fat_g: acc.fat_g + meal.fat_g,
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )
}

export function getProgressPercent(current: number, target: number): number {
    if (target === 0) return 0
    return Math.min(100, Math.round((current / target) * 100))
}

export function calculateStreak(loggedDates: string[]): number {
    if (loggedDates.length === 0) return 0

    const sorted = [...loggedDates].sort((a, b) => b.localeCompare(a))
    const today = new Date().toISOString().split('T')[0]

    let streak = 0
    let current = today

    for (const date of sorted) {
        if (date === current) {
            streak++
            const d = new Date(current)
            d.setDate(d.getDate() - 1)
            current = d.toISOString().split('T')[0]
        } else {
            break
        }
    }

    return streak
}