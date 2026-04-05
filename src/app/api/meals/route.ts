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

    let query = supabaseAdmin
        .from('meals')
        .select('*')
        .eq('user_id', user.id)

    if (date) {
        // Jour précis
        const start = `${date}T00:00:00.000Z`
        const end = `${date}T23:59:59.999Z`
        query = query.gte('logged_at', start).lte('logged_at', end)
    } else if (dateFrom && dateTo) {
        // Plage de dates (pour le rapport 7 jours et l'historique mois)
        const start = `${dateFrom}T00:00:00.000Z`
        const end = `${dateTo}T23:59:59.999Z`
        query = query.gte('logged_at', start).lte('logged_at', end)
    }

    const { data, error } = await query.order('logged_at', { ascending: false })

    if (error) {
        console.log("❌ GET ERROR:", error)
        return NextResponse.json({ success: false, error: error.message })
    }

    return NextResponse.json({ success: true, data })
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

    const mealData = {
        user_id: user.id,
        food_item_id: body.food_item_id || null,
        custom_name: body.custom_name || "Repas",
        portion_g: Number(body.portion_g || 0),
        calories: Number(body.calories || 0),
        protein_g: Number(body.protein_g || 0),
        carbs_g: Number(body.carbs_g || 0),
        fat_g: Number(body.fat_g || 0),
        image_url: body.image_url || null,
        ai_confidence: Number(body.ai_confidence || 0),
        meal_type: body.meal_type || null,
        coach_message: body.coach_message || null,
        logged_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
        .from('meals')
        .insert(mealData)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ success: false, error: error.message })
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