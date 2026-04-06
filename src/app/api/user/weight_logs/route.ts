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

// GET /api/user/weight_logs — Récupère l'historique
export async function GET(req: NextRequest) {
    try {
        const supabase = createUserClient(req)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { data, error } = await supabaseAdmin
            .from('weight_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: true })

        if (error) {
            console.error('❌ GET weight_logs error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (err) {
        console.error('❌ GET /api/user/weight_logs error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/user/weight_logs — Ajoute une entrée dans l'historique
export async function POST(req: NextRequest) {
    try {
        const supabase = createUserClient(req)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { weight_kg } = await req.json()

        if (!weight_kg || isNaN(weight_kg) || weight_kg < 20 || weight_kg > 300) {
            return NextResponse.json({ error: 'Poids invalide' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('weight_logs')
            .insert({
                user_id: user.id,
                weight_kg,
                logged_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            console.error('❌ POST weight_logs error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (err) {
        console.error('❌ POST /api/user/weight_logs error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
