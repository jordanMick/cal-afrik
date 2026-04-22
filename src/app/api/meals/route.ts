import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_RULES, getEffectiveTier } from '@/lib/subscription'

// 🔐 client avec token user
const createUserClient = (req: NextRequest) => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization') || ''
                }
            }
        }
    )
}

// 🔥 client service role (DB full access)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getUtcRangeForLocalDay(dateStr: string, tzOffsetMin: number) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + tzOffsetMin * 60 * 1000
    const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + tzOffsetMin * 60 * 1000
    return {
        start: new Date(startUtcMs).toISOString(),
        end: new Date(endUtcMs).toISOString(),
    }
}

// 🔥 GET
export async function GET(req: NextRequest) {
    const supabase = createUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Non autorisé' })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')           // un jour précis
    const dateFrom = searchParams.get('date_from')  // plage de dates début
    const dateTo = searchParams.get('date_to')      // plage de dates fin
    const tzOffsetMin = Number(searchParams.get('tz_offset_min') || '0')

    let query = supabaseAdmin
        .from('meals')
        .select('*')
        .eq('user_id', user.id)

    if (date) {
        // Jour précis
        const { start, end } = getUtcRangeForLocalDay(date, tzOffsetMin)
        query = query.gte('logged_at', start).lte('logged_at', end)
    } else if (dateFrom && dateTo) {
        // Plage de dates (pour le rapport 7 jours et l'historique mois)
        const { start } = getUtcRangeForLocalDay(dateFrom, tzOffsetMin)
        const { end } = getUtcRangeForLocalDay(dateTo, tzOffsetMin)
        query = query.gte('logged_at', start).lte('logged_at', end)
    }

    const { data, error } = await query.order('logged_at', { ascending: false })

    if (error) {
        console.log("❌ GET ERROR:", error)
        return NextResponse.json({ success: false, error: error.message })
    }

    const mapped = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        food_item_id: row.food_item_id ?? null,
        custom_name: row.custom_name ?? row.name ?? row.meal_name ?? 'Repas',
        meal_type: row.meal_type ?? null,
        portion_g: Number(row.portion_g ?? 0),
        calories: Number(row.calories ?? row.total_calories ?? 0),
        protein_g: Number(row.protein_g ?? row.total_protein ?? 0),
        carbs_g: Number(row.carbs_g ?? row.total_carbs ?? 0),
        fat_g: Number(row.fat_g ?? row.total_fat ?? 0),
        image_url: row.image_url ?? null,
        ai_confidence: Number(row.ai_confidence ?? 0),
        logged_at: row.logged_at ?? row.created_at ?? new Date().toISOString(),
        coach_message: row.coach_message ?? null,
    }))

    return NextResponse.json({ success: true, data: mapped })
}

// 🔥 POST
export async function POST(req: NextRequest) {
    const supabase = createUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("❌ NO USER")
        return NextResponse.json({ success: false, error: 'Non autorisé' })
    }

    const body = await req.json()

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('subscription_tier, subscription_expires_at, paid_chat_messages_remaining, scan_feedbacks_today, paid_scans_remaining, last_usage_reset_date, chat_messages_today')
        .eq('user_id', user.id)
        .single()

    const tier = getEffectiveTier(profile)

    const todayStr = new Date().toISOString().split('T')[0]
    const isToday = profile?.last_usage_reset_date === todayStr
    let scansFeedbacksToday = profile?.scan_feedbacks_today || 0
    if (!isToday && tier !== 'free') {
        scansFeedbacksToday = 0 // Reset quotidien pour le pool partagé
    }

    const paidChatMessages = profile?.paid_chat_messages_remaining || 0
    const paidScans = profile?.paid_scans_remaining || 0

    // On considère que c'est une suggestion si :
    // - Yao a généré le contenu (flag is_suggestion ou présence de coach_message)
    // - Ou si l'ID d'un aliment contient "suggested-" ou "coach-"
    const isSuggestion = body.is_suggestion === true || !!body.coach_message || body.is_from_coach === true
    let shouldConsumePaidAction = false

    // ─── VÉRIFICATION QUOTA PARTAGÉ (SCANS + SUGGESTIONS) ───
    if (isSuggestion) {
        let limitReached = false
        if (tier === 'free' && scansFeedbacksToday >= 5) limitReached = true
        else if (tier === 'pro' && scansFeedbacksToday >= 4) limitReached = true
        else if (tier === 'premium' && scansFeedbacksToday >= 50) limitReached = true

        if (limitReached) {
            // Si limite atteinte, on regarde s'il reste des points payés (scan ou pack suggestion)
            if (paidScans > 0) {
                shouldConsumePaidAction = true
            } else if (paidChatMessages > 0) {
                // On utilise les messages payés restants comme "droit de passage"
                // et on marque qu'on doit quand même décompter un message ou marquer l'action
                shouldConsumePaidAction = true 
                body.force_use_chat_credit = true 
            } else {
                return NextResponse.json({
                    success: false,
                    code: 'LIMIT_REACHED',
                    error: tier === 'free'
                        ? 'Tu as atteint ta limite de 5 actions IA gratuites à vie. Passe au plan Pro ou achète un pack (100 FCFA) !'
                        : 'Tu as atteint ta limite de 4 actions IA aujourd\'hui. Reviens demain ou achète un pack (100 FCFA) !'
                }, { status: 403 })
            }
        }
    }

    const mealData = {
        user_id: user.id,
        custom_name: body.custom_name || "Repas",
        portion_g: Number(body.portion_g || 0),
        calories: Number(body.calories || 0),
        protein_g: Number(body.protein_g || 0),
        carbs_g: Number(body.carbs_g || 0),
        fat_g: Number(body.fat_g || 0),
        // Compatibilité avec anciennes vues qui lisent total_calories/created_at
        total_calories: Number(body.calories || 0),
        image_url: body.image_url || null,
        ai_confidence: Number(body.ai_confidence || 0),
        meal_type: body.meal_type || null,
        coach_message: body.coach_message || null,
        logged_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
        .from('meals')
        .insert(mealData)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ success: false, error: error.message })
    }

    // Mise à jour de l'utilisation APRES succès de l'insertion
    if (isSuggestion) {
        const updatePayload: any = { updated_at: new Date().toISOString() }
        const effectiveTier = getEffectiveTier(profile)
        const maxStandardMessages = SUBSCRIPTION_RULES[effectiveTier].maxChatMessagesPerDay
        const messagesUsed = profile?.chat_messages_today || 0

        if (shouldConsumePaidAction) {
            updatePayload.paid_scans_remaining = Math.max(0, paidScans - 1)
        } else {
            updatePayload.scan_feedbacks_today = scansFeedbacksToday + 1
            updatePayload.last_usage_reset_date = todayStr

            // On ne reset plus les messages payés ici, on laisse l'utilisateur 
            // consommer ses 10 messages jusqu'au bout dans le chat.
        }

        await supabaseAdmin
            .from('user_profiles')
            .update(updatePayload)
            .eq('user_id', user.id)
    }

    const mapped = {
        id: (data as any).id,
        user_id: (data as any).user_id,
        food_item_id: null,
        custom_name: (data as any).custom_name ?? body.custom_name ?? 'Repas',
        meal_type: (data as any).meal_type || null,
        portion_g: Number((data as any).portion_g ?? body.portion_g ?? 0),
        calories: Number((data as any).calories ?? (data as any).total_calories ?? body.calories ?? 0),
        protein_g: Number((data as any).protein_g ?? body.protein_g ?? 0),
        carbs_g: Number((data as any).carbs_g ?? body.carbs_g ?? 0),
        fat_g: Number((data as any).fat_g ?? body.fat_g ?? 0),
        image_url: (data as any).image_url || null,
        ai_confidence: Number((data as any).ai_confidence ?? body.ai_confidence ?? 0),
        logged_at: (data as any).logged_at ?? (data as any).created_at ?? new Date().toISOString(),
        coach_message: (data as any).coach_message || null,
    }

    return NextResponse.json({ success: true, data: mapped })
}


// 🔥 PATCH
export async function PATCH(req: NextRequest) {
    const supabase = createUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    const body = await req.json()
    const { id, custom_name, image_url } = body

    if (!id) {
        return NextResponse.json({ success: false, error: 'ID manquant' }, { status: 400 })
    }

    const updatePayload: Record<string, any> = {}
    if (custom_name !== undefined) updatePayload.custom_name = custom_name
    if (image_url !== undefined) updatePayload.image_url = image_url

    if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ success: false, error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from('meals')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
}

// 🔥 DELETE
export async function DELETE(req: NextRequest) {
    const supabase = createUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Non autorisé' })
    }

    const { searchParams } = new URL(req.url)
    const mealId = searchParams.get('id')

    if (!mealId) {
        return NextResponse.json({ success: false, error: 'ID manquant' })
    }

    const { error } = await supabaseAdmin
        .from('meals')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ success: false, error: error.message })
    }

    return NextResponse.json({ success: true })
}