import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getUser(req: NextRequest) {
    // Essaie d'abord le cookie
    let token = req.cookies.get('supabase-auth-token')?.value

    // Sinon essaie le header Authorization
    if (!token) {
        const auth = req.headers.get('authorization')
        if (auth?.startsWith('Bearer ')) {
            token = auth.substring(7)
        }
    }

    if (!token) return null

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
}

export async function GET(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: profile, error } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()

        if (error) {
            console.error('Profile error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!profile) {
            return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: profile })

    } catch (err) {
        console.error('GET /api/user error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const body = await req.json()

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: profile, error } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                user_id: user.id,
                name: body.name,
                age: body.age,
                gender: body.gender,
                weight_kg: body.weight_kg,
                height_cm: body.height_cm,
                activity_level: body.activity_level,
                goal: body.goal,
                calorie_target: body.calorie_target,
                protein_target_g: body.protein_target_g,
                carbs_target_g: body.carbs_target_g,
                fat_target_g: body.fat_target_g,
                preferred_cuisines: body.preferred_cuisines,
                dietary_restrictions: body.dietary_restrictions,
                language: body.language || 'fr',
                country: body.country,
                onboarding_done: true,
            })
            .select()
            .single()

        if (error) {
            console.error('Upsert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: profile }, { status: 201 })

    } catch (err) {
        console.error('POST /api/user error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}