import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_RULES, getEffectiveTier } from '@/lib/subscription'
import { buildDietaryContextLine } from '@/lib/dietaryContext'

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

        // 1. Récupérer le profil complet avec les quotas
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

        let tier = profile.subscription_tier || 'free'
        const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
        if (expiresAt && expiresAt < new Date()) {
            tier = 'free'
            if (profile.subscription_tier !== 'free') {
                await supabase
                    .from('user_profiles')
                    .update({ subscription_tier: 'free' })
                    .eq('user_id', user.id)
            }
        }
        const effectiveTier = getEffectiveTier(profile)
        const today = new Date().toISOString().split('T')[0]
        const isToday = profile.last_usage_reset_date === today

        // 2. Calcul des quotas de feedback scanner par tier
        const scanFeedbacksUsed = profile.scan_feedbacks_today || 0
        const paidFeedbacks = profile.paid_coach_feedbacks_remaining || 0

        let mustUsePaid = false
        if (effectiveTier === 'free') {
            const limit = Number(SUBSCRIPTION_RULES.free.maxCoachFeedbackPerDay || 5)
            if (scanFeedbacksUsed >= limit) {
                if (paidFeedbacks <= 0) {
                    return NextResponse.json({
                        success: false,
                        code: 'FREE_LIFETIME_USED',
                        error: `Tu as déjà utilisé tes ${limit} analyses gratuites à vie. Passe au Plan Pro ou achète un scan à l'unité (100 FCFA) !`,
                    }, { status: 403 })
                }
                mustUsePaid = true
            }
        } else if (effectiveTier === 'pro') {
            const limit = Number(SUBSCRIPTION_RULES.pro.maxCoachFeedbackPerDay || 2)
            if (scanFeedbacksUsed >= limit) {
                if (paidFeedbacks <= 0) {
                    return NextResponse.json({
                        success: false,
                        code: 'PRO_DAILY_LIMIT',
                        error: `Tu as déjà demandé tes ${limit} conseils du jour. Reviens demain ou achète un scan à l'unité (100 FCFA) !`,
                    }, { status: 403 })
                }
                mustUsePaid = true
            }
        }

        const {
            selectedFoods,
            totals,
            slotLabel,
            slotTarget,
            slotConsumed,
            calorieTarget,
        } = await req.json()

        const newSlotConsumed = slotConsumed + totals.calories
        const exceeded = newSlotConsumed > slotTarget
        const exceedAmount = Math.round(newSlotConsumed - slotTarget)
        const remainingAfter = Math.max(0, slotTarget - newSlotConsumed)

        // ─── MODE SIMULATION ──────────────────────────────────────────
        const MOCK_MODE = false
        if (MOCK_MODE) {
            const protein = Number(totals?.protein_g || 0)
            const carbs = Number(totals?.carbs_g || 0)
            const fat = Number(totals?.fat_g || 0)
            let macroAdvice = "Bon équilibre global, continue comme ça."
            if (protein < 20) {
                macroAdvice = "Ajoute une source de protéines (oeuf, poisson, haricots) pour mieux soutenir ce créneau."
            } else if (carbs > protein * 3) {
                macroAdvice = "Repas très riche en glucides: complète avec une protéine maigre pour stabiliser l'énergie."
            } else if (fat > 35) {
                macroAdvice = "Lipides élevés: allège la prochaine préparation (moins d'huile, cuisson grillée/vapeur)."
            }

            const slotFeedback = exceeded
                ? `Tu dépasses l'objectif du créneau ${slotLabel} de ${exceedAmount} kcal.`
                : `Tu restes dans l'objectif du créneau ${slotLabel} (${remainingAfter} kcal restants).`
            const mealContext = `Repas scanné: ${(selectedFoods || []).join(', ') || 'Repas détecté'}.`
            const message = `${mealContext} ${slotFeedback} ${macroAdvice} Garde le cap, tu progresses bien 💪`

            // Mise à jour des quotas comme si la vraie IA avait répondu
            if (effectiveTier === 'free') {
                await supabase.from('user_profiles').update({ has_used_free_lifetime_feedback: true }).eq('user_id', user.id)
            } else if (effectiveTier === 'pro') {
                const scanFeedbacksToday = isToday ? (profile.scan_feedbacks_today || 0) : 0
                await supabase.from('user_profiles').update({ scan_feedbacks_today: scanFeedbacksToday + 1, last_usage_reset_date: today }).eq('user_id', user.id)
            }
            return NextResponse.json({
                success: true,
                message,
                exceeded,
                remainingAfter
            })
        }

        // 4. Générer le conseil IA
        const dietaryLine = buildDietaryContextLine(profile.dietary_restrictions)
        const prompt = `Tu es Coach Yao, l'expert nutritionniste de Cal Afrik. Ton rôle est d'analyser avec précision le repas que l'utilisateur vient de valider et de lui donner un feedback motivant mais scientifiquement pertinent.${dietaryLine}

L'utilisateur a mangé pour son ${slotLabel.toLowerCase()} : ${selectedFoods.join(', ')}.

DONNÉES NUTRITIONNELLES :
- Somme du repas : ${Math.round(totals.calories)} kcal
- Macros : Protéines ${totals.protein_g}g, Glucides ${totals.carbs_g}g, Lipides ${totals.fat_g}g.
- Objectif du créneau (${slotLabel}) : ${slotTarget} kcal
- État après repas : ${exceeded ? `DÉPASSEMENT de ${exceedAmount} kcal` : `Reste ${remainingAfter} kcal disponibles pour ce créneau`}.
- Objectif journalier total : ${calorieTarget} kcal.

TON ANALYSE (4 à 6 phrases) :
1. Analyse les macros : Est-ce trop gras ? Manque-t-il de protéines pour la satiété ? Trop de glucides pour ce moment de la journée ?
2. Impact sur la journée : Comment ce repas influence-t-il ce qu'il reste à manger aujourd'hui ?
3. Conseil concret : Suggère un ajustement spécifique pour le PROCHAIN REPAS ou un aliment africain précis (ex: Moringa, Hibiscus, Fonio, légumineuses) à ajouter ou réduire pour rééquilibrer la journée.

Ton ton doit rester celui d'un grand frère bienveillant, expert et encourageant. Utilises des expressions locales si approprié. Termine par une petite phrase de motivation et un émoji.`

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }]
        })

        const message = response.content[0].type === 'text'
            ? response.content[0].text
            : 'Bon repas ! Continue comme ça 💪'

        // 5. Mettre à jour les quotas en base de données
        if (mustUsePaid) {
            console.log(`[COACH] Using 1 paid coach feedback for user ${user.id}. Remaining before: ${paidFeedbacks}`)
            await supabase
                .from('user_profiles')
                .update({ 
                    paid_coach_feedbacks_remaining: Math.max(0, paidFeedbacks - 1),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
        } else if (profile.last_usage_reset_date !== today) {
            await supabase
                .from('user_profiles')
                .update({ last_usage_reset_date: today })
                .eq('user_id', user.id)
        }

        return NextResponse.json({ success: true, message, exceeded, remainingAfter })

    } catch (err: any) {
        console.error('❌ Coach API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
