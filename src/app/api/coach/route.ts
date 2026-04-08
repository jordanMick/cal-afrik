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

        // 1. Récupérer le profil complet avec les quotas
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

        const tier = profile.subscription_tier || 'free'
        const today = new Date().toISOString().split('T')[0]
        const isToday = profile.last_usage_reset_date === today

        // 2. Calcul des quotas de feedback scanner par tier
        if (tier === 'free') {
            if (profile.has_used_free_lifetime_feedback) {
                return NextResponse.json({
                    success: false,
                    code: 'FREE_LIFETIME_USED',
                    error: 'Vous avez déjà utilisé votre essai gratuit. Passez au Plan Pro pour des feedbacks quotidiens.',
                }, { status: 403 })
            }
        } else if (tier === 'pro') {
            const scanFeedbacksToday = isToday ? (profile.scan_feedbacks_today || 0) : 0
            if (scanFeedbacksToday >= 1) {
                return NextResponse.json({
                    success: false,
                    code: 'PRO_DAILY_LIMIT',
                    error: 'Vous avez déjà demandé votre conseil journalier. Revenez demain ou passez au Premium !',
                }, { status: 403 })
            }
        }

        const {
            selectedFoods,
            totals,
            slotLabel,
            slotTarget,
            slotConsumed,
            calorieTarget,
            preferredCoachMessage,
        } = await req.json()

        // ─── MODE SIMULATION ──────────────────────────────────────────
        const MOCK_MODE = false
        if (MOCK_MODE) {
            // Mise à jour des quotas comme si la vraie IA avait répondu
            if (tier === 'free') {
                await supabase.from('user_profiles').update({ has_used_free_lifetime_feedback: true }).eq('user_id', user.id)
            } else if (tier === 'pro') {
                const scanFeedbacksToday = isToday ? (profile.scan_feedbacks_today || 0) : 0
                await supabase.from('user_profiles').update({ scan_feedbacks_today: scanFeedbacksToday + 1, last_usage_reset_date: today }).eq('user_id', user.id)
            }
            return NextResponse.json({
                success: true,
                message: preferredCoachMessage || "[Mode TEST 🔧] Excellent choix ! Ce repas est bien équilibré en macros. Pense à bien t'hydrater et à faire une petite marche après. Continue comme ça ! 💪",
                exceeded: false,
                remainingAfter: 200
            })
        }

        const newSlotConsumed = slotConsumed + totals.calories
        const exceeded = newSlotConsumed > slotTarget
        const exceedAmount = Math.round(newSlotConsumed - slotTarget)
        const remainingAfter = Math.max(0, slotTarget - newSlotConsumed)

        // 4. Générer le conseil IA
        const prompt = `Tu es Coach Yao, un nutritionniste africain bienveillant et enthousiaste. Ton ton est chaleureux, direct et positif.

L'utilisateur vient de scanner son ${slotLabel.toLowerCase()} : ${selectedFoods.join(', ')}.

Détail du repas :
- Calories : ${Math.round(totals.calories)} kcal
- Protéines : ${totals.protein_g}g | Glucides : ${totals.carbs_g}g | Lipides : ${totals.fat_g}g

Situation du créneau "${slotLabel}" :
- Cible : ${slotTarget} kcal
- Déjà consommé : ${Math.round(slotConsumed)} kcal → Maintenant : ${Math.round(newSlotConsumed)} kcal
- ${exceeded ? `⚠️ Dépassement de ${exceedAmount} kcal` : `✅ Il reste ${remainingAfter} kcal`}
- Objectif journalier total : ${calorieTarget} kcal

Donne un conseil court (2-3 phrases max) en français. ${exceeded
            ? `Signale le dépassement de ${exceedAmount} kcal de façon bienveillante et propose comment compenser avec un aliment africain concret.`
            : `Valide le repas et si des macros manquent, suggère 1 aliment africain concret à ajouter.`
        }
Termine par une phrase d'encouragement courte et utilise 1 émoji africain/alimentaire.`

        let message = preferredCoachMessage || ''
        if (!message) {
            const response = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 250,
                messages: [{ role: 'user', content: prompt }]
            })

            message = response.content[0].type === 'text'
                ? response.content[0].text
                : 'Bon repas ! Continue comme ça 💪'
        }

        // 5. Mettre à jour les quotas en base de données
        if (tier === 'free') {
            await supabase
                .from('user_profiles')
                .update({ has_used_free_lifetime_feedback: true })
                .eq('user_id', user.id)
        } else if (tier === 'pro') {
            const scanFeedbacksToday = isToday ? (profile.scan_feedbacks_today || 0) : 0
            await supabase
                .from('user_profiles')
                .update({
                    scan_feedbacks_today: scanFeedbacksToday + 1,
                    last_usage_reset_date: today
                })
                .eq('user_id', user.id)
        }

        return NextResponse.json({ success: true, message, exceeded, remainingAfter })

    } catch (err: any) {
        console.error('❌ Coach API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}