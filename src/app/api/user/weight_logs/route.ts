import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
}

// GET /api/user/weight_logs — Récupère l'historique
export async function GET(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { data, error } = await supabaseAdmin
            .from('weight_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: true })

        if (error) {
            console.error('❌ GET weight_logs error:', error)
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch (err) {
        console.error('❌ GET /api/user/weight_logs error:', err)
        return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/user/weight_logs — Ajoute une entrée dans l'historique
export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { weight_kg } = await req.json()

        if (!weight_kg || isNaN(weight_kg) || weight_kg < 20 || weight_kg > 300) {
            return NextResponse.json({ success: false, error: 'Poids invalide' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('weight_logs')
            .insert({
                user_id: user.id,
                weight_kg: parseFloat(weight_kg),
                logged_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            console.error('❌ POST weight_logs error:', error)
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (err) {
        console.error('❌ POST /api/user/weight_logs error:', err)
        return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
    }
}

