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
        const { searchParams } = new URL(req.url)
        const search = searchParams.get('search')
        const limitParam = searchParams.get('limit')

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
                    limit = 2000
                }
            }
        }

        // Si ?limit= est précisé, on l'utilise (ex: limit=1 pour le prefill)
        if (limitParam) {
            limit = Math.min(parseInt(limitParam), 2000)
        }

        let query = supabase.from('food_items').select('*')

        // ─── Recherche par nom si ?search= est fourni ────────────
        if (search && search.trim().length > 0) {
            // On cherche dans name_standard ET display_name
            query = query.or(
                `name_standard.ilike.%${search.trim()}%,display_name.ilike.%${search.trim()}%`
            )
        }

        const { data, error } = await query.limit(limit)

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

        if (!name_fr || !category || calories_per_100g === undefined) {
            return NextResponse.json({
                success: false,
                error: 'Champs obligatoires manquants : name_fr, category, calories_per_100g'
            }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('food_items')
            .insert({
                name_standard: name_fr,
                display_name: name_local || null,
                category,
                calories_per_100g,
                proteins_100g: protein_per_100g ?? 0,
                carbs_100g: carbs_per_100g ?? 0,
                lipids_100g: fat_per_100g ?? 0,
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