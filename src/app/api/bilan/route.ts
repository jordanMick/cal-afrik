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
            dailyCalories,
            dailyProtein,
            dailyCarbs,
            dailyFat,
            calorieTarget,
            proteinTarget,
            carbsTarget,
            fatTarget,
            meals, // liste des repas du jour [{name, calories}]
            goal,  // objectif utilisateur: perdre/maintenir/prendre
        } = await req.json()

        const goalReached = dailyCalories >= calorieTarget * 0.9 && dailyCalories <= calorieTarget * 1.1
        const exceeded = dailyCalories > calorieTarget * 1.1
        const pctCalories = Math.round((dailyCalories / calorieTarget) * 100)

        const prompt = `Tu es un coach nutritionnel bienveillant expert en cuisine africaine subsaharienne.

Voici le bilan nutritionnel de la journée de l'utilisateur :

Repas consommés : ${meals.length > 0 ? meals.map((m: any) => `${m.name} (${m.calories} kcal)`).join(', ') : 'Aucun repas enregistré'}

Bilan :
- Calories : ${Math.round(dailyCalories)} / ${calorieTarget} kcal (${pctCalories}%)
- Protéines : ${Math.round(dailyProtein)} / ${proteinTarget}g
- Glucides : ${Math.round(dailyCarbs)} / ${carbsTarget}g
- Lipides : ${Math.round(dailyFat)} / ${fatTarget}g

Objectif de l'utilisateur : ${goal === 'perdre' ? 'Perdre du poids' : goal === 'prendre' ? 'Prendre du poids' : 'Maintenir le poids'}

Statut : ${goalReached ? 'Objectif atteint ✅' : exceeded ? 'Objectif dépassé ⚠️' : 'Objectif non atteint 📊'}

Écris un message de bilan personnalisé en français (4-5 phrases max) :
1. Commence par féliciter si objectif atteint, encourager si non atteint, ou recadrer bienveillamment si dépassé
2. Mentionne 1-2 points spécifiques sur les macros (ce qui était bien ou ce qui manquait)
3. Donne 1 conseil concret pour demain basé sur l'objectif de l'utilisateur
4. Termine avec une phrase d'encouragement chaleureuse et motivante

Ton style : chaleureux, motivant, comme un ami coach. Pas de liste, juste du texte naturel.`

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{ role: 'user', content: prompt }]
        })

        const message = response.content[0].type === 'text'
            ? response.content[0].text
            : 'Belle journée ! Reviens demain pour continuer sur ta lancée 💪'

        return NextResponse.json({ success: true, message, goalReached, exceeded })

    } catch (err: any) {
        console.error('❌ Bilan API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}