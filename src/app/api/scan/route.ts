import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanMealFromImage } from '@/lib/anthropic'

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

export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const body = await req.json()
        const { imageBase64, mimeType = 'image/jpeg' } = body

        if (!imageBase64) {
            return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
        }

        // Analyse IA
        const scanResult = await scanMealFromImage(imageBase64, mimeType)

        // Recherche en BDD africaine
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: matchedFood } = await supabaseAdmin
            .from('food_items')
            .select('*')
            .ilike('name_fr', `%${scanResult.food_name}%`)
            .limit(1)
            .maybeSingle()

        if (matchedFood) {
            const portionFactor = scanResult.estimated_portion_g / 100
            scanResult.matched_food_id = matchedFood.id
            scanResult.calories = Math.round(matchedFood.calories_per_100g * portionFactor)
            scanResult.protein_g = Math.round(matchedFood.protein_per_100g * portionFactor * 10) / 10
            scanResult.carbs_g = Math.round(matchedFood.carbs_per_100g * portionFactor * 10) / 10
            scanResult.fat_g = Math.round(matchedFood.fat_per_100g * portionFactor * 10) / 10
            scanResult.confidence = Math.min(100, scanResult.confidence + 10)
        }

        return NextResponse.json({ success: true, data: scanResult })

    } catch (error) {
        console.error('Erreur scan IA:', error)
        return NextResponse.json(
            { error: 'Erreur lors de l\'analyse. Réessayez.' },
            { status: 500 }
        )
    }
}