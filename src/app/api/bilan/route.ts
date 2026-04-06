import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (!user || authError) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const {
            calorieTarget,
            proteinTarget,
            carbsTarget,
            fatTarget,
            goal,
        } = await req.json()

        // ✅ On relit les repas d'AUJOURD'HUI directement depuis la BD
        // pour ne jamais dépendre du store Zustand côté client
        const today = new Date().toISOString().split('T')[0]
        const start = `${today}T00:00:00.000Z`
        const end = `${today}T23:59:59.999Z`

        const { data: todayMeals, error: mealsError } = await supabaseAdmin
            .from('meals')
            .select('custom_name, calories, protein_g, carbs_g, fat_g')
            .eq('user_id', user.id)
            .gte('logged_at', start)
            .lte('logged_at', end)

        if (mealsError) {
            console.error('❌ Meals fetch error:', mealsError)
            return NextResponse.json({ success: false, error: mealsError.message }, { status: 500 })
        }

        const meals = todayMeals ?? []

        // ✅ Cas aucun repas : on retourne un flag spécial, pas de bilan IA
        if (meals.length === 0) {
            return NextResponse.json({
                success: true,
                empty: true,
                message: null,
                dailyCalories: 0,
                dailyProtein: 0,
                dailyCarbs: 0,
                dailyFat: 0,
            })
        }

        // ✅ Calcul des totaux depuis la BD (source de vérité)
        const dailyCalories = meals.reduce((acc, m) => acc + (m.calories ?? 0), 0)
        const dailyProtein = meals.reduce((acc, m) => acc + (m.protein_g ?? 0), 0)
        const dailyCarbs = meals.reduce((acc, m) => acc + (m.carbs_g ?? 0), 0)
        const dailyFat = meals.reduce((acc, m) => acc + (m.fat_g ?? 0), 0)

        const goalReached = dailyCalories >= calorieTarget * 0.9 && dailyCalories <= calorieTarget * 1.1
        const exceeded = dailyCalories > calorieTarget * 1.1
        const pctCalories = Math.round((dailyCalories / calorieTarget) * 100)

        const prompt = `Tu es un coach nutritionnel bienveillant expert en cuisine africaine subsaharienne.

Voici le bilan nutritionnel de la journée de l'utilisateur :

Repas consommés : ${meals.map((m: any) => `${m.custom_name} (${Math.round(m.calories)} kcal)`).join(', ')}

Bilan :
- Calories : ${Math.round(dailyCalories)} / ${calorieTarget} kcal (${pctCalories}%)
- Protéines : ${Math.round(dailyProtein)} / ${proteinTarget}g
- Glucides : ${Math.round(dailyCarbs)} / ${carbsTarget}g
- Lipides : ${Math.round(dailyFat)} / ${fatTarget}g

Objectif : ${goal === 'perdre' ? 'Perdre du poids' : goal === 'prendre' ? 'Prendre du poids' : 'Maintenir le poids'}

Statut : ${goalReached ? 'Objectif atteint ✅' : exceeded ? 'Objectif dépassé ⚠️' : 'Objectif non atteint 📊'}

Écris un message de bilan personnalisé en français (4-5 phrases max) :
1. Commence par féliciter si objectif atteint, encourager si non atteint, ou recadrer bienveillamment si dépassé
2. Mentionne 1-2 points spécifiques sur les macros (ce qui était bien ou ce qui manquait)
3. Donne 1 conseil concret pour demain basé sur l'objectif
4. Termine avec une phrase d'encouragement chaleureuse

Ton style : chaleureux, motivant, comme un ami coach. Pas de liste, juste du texte naturel.`

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{ role: 'user', content: prompt }]
        })

        const message = response.content[0].type === 'text'
            ? response.content[0].text
            : 'Belle journée ! Reviens demain pour continuer sur ta lancée 💪'

        return NextResponse.json({
            success: true,
            empty: false,
            message,
            goalReached,
            exceeded,
            // ✅ On renvoie aussi les vrais totaux pour que le front les affiche
            dailyCalories: Math.round(dailyCalories),
            dailyProtein: Math.round(dailyProtein),
            dailyCarbs: Math.round(dailyCarbs),
            dailyFat: Math.round(dailyFat),
        })

    } catch (err: any) {
        console.error('❌ Bilan API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}