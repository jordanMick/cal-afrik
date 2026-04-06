// /api/bilan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
    // ─── MODE SIMULATION (POUR ÉCONOMISER LES TOKENS EN TEST) ───
    const MOCK_MODE = true 

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) return NextResponse.json({ success: false }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        )

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ success: false }, { status: 401 })

        const body = await req.json()
        const {
            type, // 'creneau' | 'journee'
            slot,
            slotLabel,
            nextSlotLabel,
            slotConsumed,
            slotTarget,
            dailyCalories,
            dailyProtein,
            dailyCarbs,
            dailyFat,
            calorieTarget,
            proteinTarget,
            carbsTarget,
            fatTarget,
            goal,
            meals,
        } = body

        if (MOCK_MODE) {
            console.log("🛠️ MOCK MODE: Simulation d'un bilan Coach")
            return NextResponse.json({
                success: true,
                message: type === 'creneau' 
                    ? `[Mode TEST] Excellent choix pour votre ${slotLabel}. L'équilibre entre protéines et glucides est idéal pour votre objectif de ${goal}. Continuez sur cette lancée !`
                    : `[Mode TEST] Bilan de la journée : Vous avez atteint 95% de vos objectifs. Votre apport en protéines est parfait. Une légère marche de 15 minutes ce soir optimisera votre digestion.`,
                goalReached: true,
                exceeded: false
            })
        }

        // Pas de repas et ce n'est pas le bilan de fin de journée
        if (type === 'creneau' && (!meals || meals.length === 0)) {
            return NextResponse.json({ success: true, empty: true })
        }

        // ─── VÉRIFICATION ABONNEMENT ──────────────────────────
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('user_id', user.id)
            .single()

        const isPremium = profile?.subscription_tier === 'premium'

        if (!isPremium) {
            return NextResponse.json({
                success: true,
                message: type === 'creneau' 
                    ? "Bon repas ! Continue tes efforts. 💪" 
                    : "Belle journée terminée ! Repose-toi bien. 🌙",
                goalReached: type === 'creneau' ? (Math.round((slotConsumed / slotTarget) * 100) >= 80) : true,
                exceeded: false
            })
        }

        const goalLabels: Record<string, string> = {
            perdre: 'perdre du poids',
            maintenir: 'maintenir le poids',
            prendre: 'prendre du poids',
        }
        const goalLabel = goalLabels[goal] || 'maintenir le poids'

        let prompt = ''

        if (type === 'creneau') {
            // ── Bilan de créneau ──────────────────────────────────
            const pct = Math.round((slotConsumed / slotTarget) * 100)
            const slotGoalReached = pct >= 80 && pct <= 120
            const slotExceeded = pct > 120

            const mealsText = meals.map((m: { name: string; calories: number }) =>
                `- ${m.name} : ${m.calories} kcal`
            ).join('\n')

            prompt = `Tu es un coach nutritionnel bienveillant. L'utilisateur vient de terminer son créneau "${slotLabel}".

Son objectif global est de ${goalLabel}.

Repas consommés pendant ce créneau :
${mealsText}

Calories du créneau : ${Math.round(slotConsumed)} kcal / ${slotTarget} kcal (${pct}%)
${slotGoalReached ? '✅ Objectif du créneau atteint.' : slotExceeded ? '⚠️ Objectif du créneau dépassé.' : '📉 En dessous de l\'objectif du créneau.'}

${nextSlotLabel ? `Le prochain créneau est : ${nextSlotLabel}.` : ''}

Écris un message court (2-3 phrases max) qui :
1. Fait un bref bilan de ce créneau (bien ou à améliorer)
2. ${nextSlotLabel ? `Donne un conseil concret pour le ${nextSlotLabel} (ex: aliment recommandé, quantité, timing)` : 'Encourage pour la suite de la journée'}

Sois direct, chaleureux, sans markdown, sans titre. Tutoie l'utilisateur.`

            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 200,
                messages: [{ role: 'user', content: prompt }]
            })

            const message = response.content[0].type === 'text' ? response.content[0].text : ''

            return NextResponse.json({
                success: true,
                message,
                goalReached: slotGoalReached,
                exceeded: slotExceeded,
            })

        } else {
            // ── Bilan de journée (diner / 23h) ────────────────────
            const calPct = Math.round((dailyCalories / calorieTarget) * 100)
            const goalReached = calPct >= 85 && calPct <= 115
            const exceeded = calPct > 115

            const proteinOk = dailyProtein >= proteinTarget * 0.8
            const carbsOk = dailyCarbs >= carbsTarget * 0.8
            const fatOk = dailyFat >= fatTarget * 0.8

            const mealsText = meals && meals.length > 0
                ? meals.map((m: { name: string; calories: number }) => `- ${m.name} : ${m.calories} kcal`).join('\n')
                : 'Aucun repas enregistré.'

            prompt = `Tu es un coach nutritionnel bienveillant. Voici le bilan de journée de l'utilisateur.

Objectif : ${goalLabel}

Repas de la journée :
${mealsText}

Résumé nutritionnel :
- Calories : ${Math.round(dailyCalories)} / ${calorieTarget} kcal (${calPct}%) ${goalReached ? '✅' : exceeded ? '⚠️' : '📉'}
- Protéines : ${Math.round(dailyProtein)} / ${proteinTarget}g ${proteinOk ? '✅' : '📉'}
- Glucides : ${Math.round(dailyCarbs)} / ${carbsTarget}g ${carbsOk ? '✅' : '📉'}
- Lipides : ${Math.round(dailyFat)} / ${fatTarget}g ${fatOk ? '✅' : '📉'}

Écris un message de bilan de journée (3-4 phrases max) qui :
1. Dit clairement si l'objectif calorique est atteint, dépassé ou incomplet
2. Mentionne les macros qui méritent attention (seulement si vraiment hors cible)
3. Si l'objectif n'est pas atteint, donne UN conseil concret pour compenser avant minuit (ex: "mange encore X kcal avec un bol de X")
4. Si l'objectif est atteint, félicite chaleureusement

Sois direct, chaleureux, sans markdown, sans titre. Tutoie l'utilisateur.`

            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 250,
                messages: [{ role: 'user', content: prompt }]
            })

            const message = response.content[0].type === 'text' ? response.content[0].text : ''

            return NextResponse.json({
                success: true,
                message,
                goalReached,
                exceeded,
            })
        }

    } catch (err) {
        console.error('Bilan API error:', err)
        return NextResponse.json({ success: false }, { status: 500 })
    }
}