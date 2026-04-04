import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (!user || authError) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const {
            selectedFoods,
            totals,
            mealCalTarget,
            remainingMealCalories,
            dailyCalories,
            calorieTarget,
            remainingProtein,
            remainingCarbs,
            remainingFat
        } = await req.json()

        const prompt = `Tu es un coach nutritionnel expert en cuisine africaine subsaharienne.

L'utilisateur vient de manger : ${selectedFoods.join(', ')}.

Valeurs de ce repas :
- Calories : ${Math.round(totals.calories)} kcal
- Objectif pour ce repas : ${mealCalTarget} kcal
- Calories restantes pour ce repas : ${remainingMealCalories} kcal

Progression journée :
- ${Math.round(dailyCalories)} / ${calorieTarget} kcal

Macros restantes :
- Protéines : ${remainingProtein}g
- Glucides : ${remainingCarbs}g
- Lipides : ${remainingFat}g

Donne un conseil court (3-4 phrases max) :
1. Évalue rapidement le repas
2. Propose 1-2 aliments africains si nécessaire
3. Encourage l'utilisateur

Réponds directement, naturel et motivant.`

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }]
        })

        const message = response.content[0].type === 'text'
            ? response.content[0].text
            : 'Bon repas ! Continue comme ça 💪'

        return NextResponse.json({ success: true, message })

    } catch (err: any) {
        console.error('❌ Coach API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}