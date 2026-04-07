// /api/bilan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
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
            type, // 'creneau' | 'journee' | 'mensuel'
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
                    : type === 'mensuel'
                        ? `[Mode TEST] Bilan mensuel : Vous avez été régulier ce mois-ci. Vos apports en protéines sont cohérents avec votre objectif. Continuez ainsi le mois prochain !`
                        : `[Mode TEST] Bilan de la journée : Vous avez atteint 95% de vos objectifs. Votre apport en protéines est parfait. Une légère marche de 15 minutes ce soir optimisera votre digestion.`,
                goalReached: true,
                exceeded: false
            })
        }

        // Pas de repas et ce n'est pas le bilan de fin de journée ni le mensuel
        if (type === 'creneau' && (!meals || meals.length === 0)) {
            return NextResponse.json({ success: true, empty: true })
        }

        // ─── VÉRIFICATION ABONNEMENT ──────────────────────────
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('subscription_tier, subscription_expires_at, monthly_ai_bilan_used_at')
            .eq('user_id', user.id)
            .single()

        let tier = profile?.subscription_tier || 'free'
        const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
        if (expiresAt && expiresAt < new Date()) tier = 'free'

        const isEndOfDay = type === 'journee'
        const isMonthly = type === 'mensuel'

        // ─── RÈGLES D'ACCÈS ───────────────────────────────────
        // free    → bilan auto local + 1 bilan mensuel IA/mois (sur bouton)
        // pro     → IA fin de journée + bilan mensuel IA illimité
        // premium → IA tous les créneaux + bilan mensuel IA illimité
        let canUseAI = false

        if (isMonthly) {
            if (tier === 'free') {
                const lastUsed = profile?.monthly_ai_bilan_used_at
                    ? new Date(profile.monthly_ai_bilan_used_at)
                    : null

                const now = new Date()
                const alreadyUsedThisMonth =
                    lastUsed !== null &&
                    lastUsed.getMonth() === now.getMonth() &&
                    lastUsed.getFullYear() === now.getFullYear()

                if (alreadyUsedThisMonth) {
                    return NextResponse.json({
                        success: false,
                        reason: 'monthly_quota_exceeded',
                        message: 'Tu as déjà utilisé ton bilan IA mensuel gratuit. Reviens le mois prochain, ou passe en Pro pour un accès illimité ! 🗓️',
                    })
                }

                // Consommer le quota mensuel
                await supabase
                    .from('user_profiles')
                    .update({ monthly_ai_bilan_used_at: now.toISOString() })
                    .eq('user_id', user.id)

                canUseAI = true
            } else {
                // Pro et Premium : bilan mensuel sans quota
                canUseAI = true
            }
        } else {
            // Créneaux et journée
            canUseAI = (tier === 'premium') || (tier === 'pro' && isEndOfDay)
        }

        // ─── BILAN AUTOMATIQUE (sans IA) ─────────────────────
        if (!canUseAI) {
            if (tier === 'free') {
                return NextResponse.json({
                    success: false,
                    reason: 'upgrade_required',
                    message: 'Passe en Pro pour débloquer tes bilans quotidiens 🔥',
                    upgrade: true
                })
            }
            const calPct = Math.round((slotConsumed / slotTarget) * 100)
            let autoMsg = ''

            if (isEndOfDay) {
                const dayPct = Math.round((dailyCalories / calorieTarget) * 100)
                if (dayPct >= 85 && dayPct <= 115) autoMsg = '🎯 Belle journée ! Objectif calorique atteint. Repose-toi bien. 🌙'
                else if (dayPct > 115) autoMsg = '⚠️ Budget calories dépassé aujourd\'hui. Compensez demain avec un repas plus léger.'
                else autoMsg = '📉 Journée incomplète. Pensez à combler vos calories avant minuit.'
            } else {
                if (calPct >= 80 && calPct <= 120) autoMsg = `✅ Bon créneau ${slotLabel} ! Continue sur ta lancée.`
                else if (calPct > 120) autoMsg = `⚠️ Tu as légèrement dépassé sur le ${slotLabel}. Pense à alléger le prochain créneau.`
                else autoMsg = `💡 Il te reste encore de la marge sur le ${slotLabel}. Ajoute un aliment léger si tu as faim.`
            }

            return NextResponse.json({
                success: true,
                message: autoMsg,
                goalReached: isEndOfDay
                    ? Math.round((dailyCalories / calorieTarget) * 100) >= 85
                    : (calPct >= 80 && calPct <= 120),
                exceeded: isEndOfDay
                    ? Math.round((dailyCalories / calorieTarget) * 100) > 115
                    : calPct > 120,
                isAutomatic: true
            })
        }

        // ─── PROMPTS IA ───────────────────────────────────────
        const goalLabels: Record<string, string> = {
            perdre: 'perdre du poids',
            maintenir: 'maintenir le poids',
            prendre: 'prendre du poids',
        }
        const goalLabel = goalLabels[goal] || 'maintenir le poids'

        let prompt = ''

        if (type === 'creneau') {
            // ── Bilan de créneau ──────────────────────────────
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
                model: 'claude-haiku-4-5-20251001',
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

        } else if (type === 'journee') {
            // ── Bilan de journée ──────────────────────────────
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

        } else if (type === 'mensuel') {
            // ── Bilan mensuel ─────────────────────────────────
            const mealsText = meals && meals.length > 0
                ? meals.map((m: { name: string; calories: number }) => `- ${m.name} : ${m.calories} kcal`).join('\n')
                : 'Aucune donnée de repas fournie.'

            const calPct = Math.round((dailyCalories / calorieTarget) * 100)
            const goalReached = calPct >= 85 && calPct <= 115
            const exceeded = calPct > 115

            prompt = `Tu es un coach nutritionnel bienveillant. Voici le bilan mensuel de l'utilisateur.

Objectif : ${goalLabel}

Résumé nutritionnel moyen sur le mois :
- Calories : ${Math.round(dailyCalories)} / ${calorieTarget} kcal (${calPct}%)
- Protéines : ${Math.round(dailyProtein)} / ${proteinTarget}g
- Glucides : ${Math.round(dailyCarbs)} / ${carbsTarget}g
- Lipides : ${Math.round(dailyFat)} / ${fatTarget}g

Repas les plus fréquents ce mois :
${mealsText}

Écris un bilan mensuel motivant (4-5 phrases max) qui :
1. Évalue la régularité et la cohérence des apports sur le mois
2. Identifie le point fort nutritionnel du mois
3. Donne UN axe d'amélioration concret pour le mois suivant
4. Termine sur une note d'encouragement personnalisée selon l'objectif

Sois direct, chaleureux, sans markdown, sans titre. Tutoie l'utilisateur.`

            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 350,
                messages: [{ role: 'user', content: prompt }]
            })

            const message = response.content[0].type === 'text' ? response.content[0].text : ''

            return NextResponse.json({
                success: true,
                message,
                goalReached,
                exceeded,
                isMonthly: true,
            })
        }

        return NextResponse.json({ success: false, reason: 'unknown_type' }, { status: 400 })

    } catch (err) {
        console.error('Bilan API error:', err)
        return NextResponse.json({ success: false }, { status: 500 })
    }
}