import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createUserClient = (req: NextRequest) =>
    createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    )

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/user/weight — met à jour uniquement weight_kg
export async function PATCH(req: NextRequest) {
    try {
        const supabase = createUserClient(req)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { weight_kg } = await req.json()

        if (!weight_kg || isNaN(weight_kg) || weight_kg < 20 || weight_kg > 300) {
            return NextResponse.json({ error: 'Poids invalide' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .update({ weight_kg })
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            console.error('❌ Weight update error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })

    } catch (err) {
        console.error('❌ PATCH /api/user/weight error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}