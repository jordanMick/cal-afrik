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

        // ─── VÉRIFICATION ABONNEMENT ──────────────────────────
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('user_id', user.id)
            .single()

        if (!profile || profile.subscription_tier !== 'premium') {
            return NextResponse.json({ 
                success: false, 
                error: 'Accès réservé aux membres Premium', 
                code: 'PREMIUM_REQUIRED' 
            }, { status: 403 })
        }

        const {
            selectedFoods,       // noms des aliments sélectionnés
            totals,              // { calories, protein_g, carbs_g, fat_g } du repas
            slotLabel,           // "Petit-déjeuner", "Déjeuner", etc.
            slotTarget,          // cible kcal du créneau actuel
            slotConsumed,        // kcal déjà consommées dans ce créneau avant cet ajout
            slotRemaining,       // kcal restantes dans ce créneau après cet ajout
            dailyCalories,       // total kcal journée
            calorieTarget,       // objectif journalier
        } = await req.json()

        // ─── MODE SIMULATION (POUR ÉCONOMISER LES TOKENS EN TEST) ───
        const MOCK_MODE = true 

        if (MOCK_MODE) {
            const newSlotConsumed = slotConsumed + totals.calories
            const remainingAfter = Math.max(0, slotTarget - newSlotConsumed)
            const exceeded = newSlotConsumed > slotTarget

            return NextResponse.json({ 
                success: true, 
                message: "[Mode TEST] Superbe choix ! Vos macros sont bien équilibrées. Pensez à boire beaucoup d'eau avec ce repas consistant. 💪", 
                exceeded, 
                remainingAfter 
            })
        }

        const newSlotConsumed = slotConsumed + totals.calories
        const exceeded = newSlotConsumed > slotTarget
        const exceedAmount = Math.round(newSlotConsumed - slotTarget)
        const remainingAfter = Math.max(0, slotTarget - newSlotConsumed)

        const prompt = `Tu es un coach nutritionnel bienveillant expert en cuisine africaine subsaharienne.

L'utilisateur vient d'ajouter son ${slotLabel.toLowerCase()} : ${selectedFoods.join(', ')}.

Détail du repas :
- Calories ajoutées : ${Math.round(totals.calories)} kcal
- Protéines : ${totals.protein_g}g
- Glucides : ${totals.carbs_g}g  
- Lipides : ${totals.fat_g}g

Situation du créneau "${slotLabel}" :
- Cible du créneau : ${slotTarget} kcal
- Déjà consommé avant : ${Math.round(slotConsumed)} kcal
- Total consommé maintenant : ${Math.round(newSlotConsumed)} kcal
- ${exceeded ? `Dépassement de ${exceedAmount} kcal` : `Il reste ${remainingAfter} kcal pour ce créneau`}

Total journée : ${Math.round(dailyCalories + totals.calories)} / ${calorieTarget} kcal

Donne un conseil court (2-3 phrases) en français :
${exceeded
                ? `1. Signale le dépassement de ${exceedAmount} kcal de façon bienveillante\n2. Conseille comment compenser au prochain créneau avec un aliment africain concret`
                : `1. Valide le repas et mentionne les ${remainingAfter} kcal restantes pour ce créneau\n2. Si des macros manquent, propose 1 aliment africain concret à ajouter`
            }
3. Termine avec une phrase d'encouragement courte

Réponds directement, ton naturel et bienveillant.`

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 250,
            messages: [{ role: 'user', content: prompt }]
        })

        const message = response.content[0].type === 'text'
            ? response.content[0].text
            : 'Bon repas ! Continue comme ça 💪'

        return NextResponse.json({ success: true, message, exceeded, remainingAfter })

    } catch (err: any) {
        console.error('❌ Coach API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}