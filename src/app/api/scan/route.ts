import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanMealFromImage } from '@/lib/anthropic'
import type { ScanApiResponse, ScanComponent } from '@/types'

// ─── NORMALIZE ───────────────────────────────────────────────
function normalize(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
}

// ─── SCORE ───────────────────────────────────────────────────
function scoreFood(itemName: string, food: any) {
    const input = normalize(itemName)
    const names = [food.name_fr, food.name_local, food.name_en]
        .filter(Boolean)
        .map(normalize)

    let score = 0
    for (const name of names) {
        if (input === name) score += 100
        if (input.includes(name)) score += 50
        if (name.includes(input)) score += 40
        const inputWords = input.split(" ")
        const nameWords = name.split(" ")
        for (const word of inputWords) {
            if (word.length > 2 && nameWords.includes(word)) score += 15
        }
    }
    return score
}

// ─── TOP 3 MATCHES ───────────────────────────────────────────
function getTopMatches(itemName: string, foods: any[]) {
    return foods
        .map(food => ({ food, score: scoreFood(itemName, food) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
}

// ─── AUTH ────────────────────────────────────────────────────
async function getUser(req: NextRequest) {
    const token = req.cookies.get('supabase-auth-token')?.value
    if (!token) return null

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
}

// ─── ROUTE POST ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const body = await req.json()
        const { imageBase64, mimeType = 'image/jpeg' } = body

        if (!imageBase64) {
            return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
        }

        // ─── ANALYSE IA → retourne ScanResultV2 décomposé ───
        const scanResult = await scanMealFromImage(imageBase64, mimeType)

        // ─── MATCHING BD pour chaque composant ───────────────
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: foodItems } = await supabaseAdmin
            .from('food_items')
            .select('id, name_fr, name_local, name_en, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')

        const results = []

        for (const component of scanResult.components) {
            const topMatches = getTopMatches(component.food_name, foodItems || [])
            const portion = component.estimated_portion_g

            results.push({
                detected: component.food_name,
                portion_g: portion,
                // ✅ Valeurs calculées par l'IA pour cette portion
                calories_detected: component.calories,
                protein_detected: component.protein_g,
                carbs_detected: component.carbs_g,
                fat_detected: component.fat_g,
                confidence: component.confidence,
                // ✅ Suggestions BD avec calories recalculées pour la même portion
                suggestions: topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.name_fr,
                    score: m.score,
                    calories: Math.round((m.food.calories_per_100g * portion) / 100),
                    protein_g: Math.round((m.food.protein_per_100g * portion) / 100 * 10) / 10,
                    carbs_g: Math.round((m.food.carbs_per_100g * portion) / 100 * 10) / 10,
                    fat_g: Math.round((m.food.fat_per_100g * portion) / 100 * 10) / 10,
                }))
            })
        }

        return NextResponse.json({
            success: true,
            meal_name: scanResult.meal_name,
            total_calories: scanResult.total_calories,
            data: results
        } satisfies ScanApiResponse)

    } catch (error) {
        console.error('Erreur scan IA:', error)
        return NextResponse.json(
            {
                success: false,
                meal_name: "",
                total_calories: 0,
                data: [],
                error: 'Erreur lors de l\'analyse. Réessayez.'
            } satisfies ScanApiResponse,
            { status: 500 }
        )
    }
}