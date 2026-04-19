import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // ─── VÉRIFICATION LIMITE AJOUT REPAS (FREE TIER: 2/jour) ───
    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('user_id', user.id)
        .single()

    let tier = profile?.subscription_tier || 'free'
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
    if (expiresAt && expiresAt < new Date()) {
        tier = 'free'
    }

    if (tier === 'free') {
        const tzOffsetMin = Number(req.headers.get('x-tz-offset-min') || '0')
        // Récupérer la date locale du client ou l'heure serveur formattée
        const now = new Date()
        now.setMinutes(now.getMinutes() - tzOffsetMin)
        const todayStr = now.toISOString().split('T')[0]

        const { start, end } = getUtcRangeForLocalDay(todayStr, tzOffsetMin)
        
        const { count, error: countError } = await supabaseAdmin
            .from('meals')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('logged_at', start)
            .lte('logged_at', end)

        if (countError) {
             console.error("❌ Count error:", countError)
        } else if ((count || 0) >= 2) {
             return NextResponse.json({ 
                 success: false, 
                 code: 'LIMIT_REACHED', 
                 error: 'Tu as atteint ta limite de 2 repas ajoutés par jour (mode Gratuit). Passe au plan Pro pour un suivi illimité !' 
             }, { status: 403 })
        }
    }
    // ────────────────────────────────────────────────────────长

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