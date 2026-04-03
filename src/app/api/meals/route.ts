import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createSupabaseServer = (req: NextRequest) => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization') || ''
                }
            }
        }
    )
}

// 🔥 GET
export async function GET(req: NextRequest) {
    const supabase = createSupabaseServer(req)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Non autorisé' })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')

    let query = supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)

    if (date) {
        const start = `${date}T00:00:00.000Z`
        const end = `${date}T23:59:59.999Z`

        query = query.gte('logged_at', start).lte('logged_at', end)
    }

    const { data, error } = await query.order('logged_at', { ascending: false })

    if (error) {
        return NextResponse.json({ success: false, error: error.message })
    }

    return NextResponse.json({ success: true, data })

}

// 🔥 POST
export async function POST(req: NextRequest) {
    const supabase = createSupabaseServer(req)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Non autorisé' })
    }

    const body = await req.json()

    const { data, error } = await supabase
        .from('meals')
        .insert({
            user_id: user.id,
            food_item_id: body.food_item_id,
            custom_name: body.custom_name,
            meal_type: body.meal_type,
            portion_g: body.portion_g,
            calories: body.calories,
            protein_g: body.protein_g,
            carbs_g: body.carbs_g,
            fat_g: body.fat_g,
            image_url: body.image_url || null,
            ai_confidence: body.ai_confidence || null,
            logged_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ success: false, error: error.message })
    }

    return NextResponse.json({ success: true, data })

}

// 🔥 DELETE (NOUVEAU)
export async function DELETE(req: NextRequest) {
    const supabase = createSupabaseServer(req)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Non autorisé' })
    }

    const { searchParams } = new URL(req.url)
    const mealId = searchParams.get('id')

    if (!mealId) {
        return NextResponse.json({ success: false, error: 'ID manquant' })
    }

    const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user.id) // 🔒 sécurité

    if (error) {
        return NextResponse.json({ success: false, error: error.message })
    }

    return NextResponse.json({ success: true })

}