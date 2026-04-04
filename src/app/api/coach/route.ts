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
        // Auth
        const authHeader = req.headers.get('authorization')
        if (!authHeader) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (!user || authError) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const {
            selectedFoods,
            totals,
            mealSlot,
            mealCalTarget,
            mealProtTarget,
            mealCarbsTarget,
            mealFatTarget,
            dailyCalories,
            calorieTarget,
        } = await req.json()

        const diffCal = mealCalTarget - totals.calories
        const diffProt = mealProtTarget - totals.protein_g
        const diffCarbs = mealCarbsTarget - totals.carbs_g
        const diffFat = mealFatTarget - totals.fat_g

        const prompt = `Tu es un coach nutritionnel expert en cuisine africaine subsaharienne (Togo, Côte d'Ivoire, Sénégal, Ghana, Bénin, Nigeria).

L'utilisateur vient de scanner son ${mealSlot.label.toLowerCase()} composé de : ${selectedFoods.join(', ')}.

Valeurs de ce repas :
- Calories : ${Math.round(totals.calories)} kcal (cible pour ce repas : ${mealCalTarget} kcal, écart : ${diffCal > 0 ? '+' : ''}${Math.round(diffCal)} kcal)
- Protéines : ${totals.protein_g}g (cible : ${mealProtTarget}g, écart : ${diffProt > 0 ? '+' : ''}${Math.round(diffProt)}g)
- Glucides : ${totals.carbs_g}g (cible : ${mealCarbsTarget}g, écart : ${diffCarbs > 0 ? '+' : ''}${Math.round(diffCarbs)}g)
- Lipides : ${totals.fat_g}g (cible : ${mealFatTarget}g, écart : ${diffFat > 0 ? '+' : ''}${Math.round(diffFat)}g)

Déjà consommé aujourd'hui : ${Math.round(dailyCalories)} kcal sur ${calorieTarget} kcal.

Donne un conseil court (3-4 phrases max) en français :
1. Évalue ce repas par rapport à la cible de ce moment de la journée
2. Si des macros manquent, propose 1-2 aliments africains concrets à ajouter
3. Termine avec une phrase d'encouragement courte

Réponds directement sans introduction, de façon naturelle et bienveillante.`

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