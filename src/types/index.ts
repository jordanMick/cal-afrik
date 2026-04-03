// ─── Utilisateur ───────────────────────────────────────────────
export interface User {
    id: string
    email: string
    name: string
    avatar_url?: string
    created_at: string
}

export interface UserProfile {
    id: string
    user_id: string
    name: string
    age: number
    gender: 'homme' | 'femme' | 'autre'
    weight_kg: number
    height_cm: number
    activity_level: 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif'
    goal: 'perdre' | 'maintenir' | 'prendre'
    calorie_target: number
    protein_target_g: number
    carbs_target_g: number
    fat_target_g: number
    preferred_cuisines: string[]
    dietary_restrictions: string[]
    language: 'fr' | 'en'
    country: string
}

export interface FoodItem {
    id: string
    name_fr: string
    name_local?: string
    category: FoodCategory
    origin_country: string[]
    calories_per_100g: number
    protein_per_100g: number
    carbs_per_100g: number
    fat_per_100g: number
    fiber_per_100g?: number
    default_portion_g: number
    image_url?: string
    verified: boolean
}

export type FoodCategory =
    | 'cereales'
    | 'tubercules'
    | 'legumineuses'
    | 'viandes'
    | 'poissons'
    | 'legumes'
    | 'sauces'
    | 'boissons'
    | 'snacks'
    | 'plats_composes'

export interface Meal {
    id: string
    user_id: string
    food_item_id?: string
    custom_name?: string
    meal_type: MealType
    portion_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    image_url?: string
    ai_confidence?: number
    logged_at: string
    notes?: string
}

export type MealType = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation'

export interface DailyLog {
    date: string
    user_id: string
    total_calories: number
    total_protein_g: number
    total_carbs_g: number
    total_fat_g: number
    meals: Meal[]
    water_ml?: number
    notes?: string
}

export interface WeightLog {
    id: string
    user_id: string
    weight_kg: number
    logged_at: string
}

export interface ScanResult {
    food_name: string
    food_name_fr: string
    estimated_portion_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    confidence: number
    matched_food_id?: string
    alternatives: string[]
    notes?: string
}

export interface WeekStats {
    days: DayStats[]
    avg_calories: number
    streak: number
}

export interface DayStats {
    date: string
    calories: number
    target: number
    goal_reached: boolean
}

export interface CalorieCalculationInput {
    age: number
    gender: 'homme' | 'femme'
    weight_kg: number
    height_cm: number
    activity_level: UserProfile['activity_level']
    goal: UserProfile['goal']
}