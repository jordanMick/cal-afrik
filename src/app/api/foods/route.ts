import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── GET : récupérer les aliments selon le plan ────────────────
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        let limit = 100 // Défaut gratuit

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '')
            const { data: { user } } = await supabase.auth.getUser(token)
            
            if (user) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('subscription_tier')
                    .eq('user_id', user.id)
                    .single()
                
                if (profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'premium') {
                    limit = 2000 // Illimité (ou très large)
                }
            }
        }

        const { data, error } = await supabase
            .from('food_items')
            .select('*')
            .limit(limit)

        if (error) return NextResponse.json({ success: false, error: error.message })
        return NextResponse.json({ success: true, data })

    } catch (err) {
        return NextResponse.json({ success: false, error: 'Erreur serveur' })
    }
}

// ─── POST : créer un nouvel aliment manuellement ─────────────
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (!user || authError) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
        }

        const body = await req.json()

        const {
            name_fr,
            name_local,
            category,
            calories_per_100g,
            protein_per_100g,
            carbs_per_100g,
            fat_per_100g,
            default_portion_g,
            origin_country,
            verified,
        } = body

        // Validation minimale
        if (!name_fr || !category || calories_per_100g === undefined) {
            return NextResponse.json({
                success: false,
                error: 'Champs obligatoires manquants : name_fr, category, calories_per_100g'
            }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('food_items')
            .insert({
                name_fr,
                name_local: name_local || null,
                category,
                calories_per_100g,
                protein_per_100g: protein_per_100g ?? 0,
                carbs_per_100g: carbs_per_100g ?? 0,
                fat_per_100g: fat_per_100g ?? 0,
                default_portion_g: default_portion_g ?? 200,
                verified: verified ?? false,
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message })
        }

        return NextResponse.json({ success: true, data })

    } catch (err) {
        return NextResponse.json({ success: false, error: 'Erreur serveur' })
    }
}