import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 🔐 Client admin pour contourner RLS si nécessaire pour la lecture globale
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthUser(req: NextRequest) {
    let token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
        token = req.cookies.get('supabase-auth-token')?.value
    }
    if (!token) return null

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    return user
}

function slugify(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '_')
        .replace(/^-+|-+$/g, '');
}

// ─── GET : récupérer les aliments filtrés par sécurité ────────────
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req)
        const { searchParams } = new URL(req.url)
        const search = searchParams.get('search')
        const limitParam = searchParams.get('limit')

        let limit = 100 // Défaut gratuit

        if (user) {
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('subscription_tier')
                .eq('user_id', user.id)
                .single()

            if (profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'premium') {
                limit = 2000
            }
        }

        if (limitParam) {
            limit = Math.min(parseInt(limitParam), 2000)
        }

        // 🛡️ SÉCURITÉ : On ne renvoie que les aliments vérifiés (officiels)
        // OU ceux créés spécifiquement par l'utilisateur connecté.
        let query = supabaseAdmin.from('food_items').select('*')
        
        if (user) {
            // Un utilisateur voit : (Les officiels) OU (Ses propres ajouts)
            query = query.or(`verified.eq.true,user_id.eq.${user.id}`)
        } else {
            // Un utilisateur non-connecté ne voit QUE les officiels
            query = query.eq('verified', true)
        }

        if (search && search.trim().length > 0) {
            query = query.or(
                `name_standard.ilike.%${search.trim()}%,display_name.ilike.%${search.trim()}%`
            )
        }

        const { data, error } = await query.limit(limit)

        if (error) return NextResponse.json({ success: false, error: error.message })
        return NextResponse.json({ success: true, data })

    } catch {
        return NextResponse.json({ success: false, error: 'Erreur serveur' })
    }
}

// ─── POST : créer un nouvel aliment (toujours non-vérifié par défaut) ─────────────
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req)
        if (!user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
        }

        const body = await req.json()

        const {
            name_standard,
            display_name,
            category,
            calories_per_100g,
            proteins_100g,
            carbs_100g,
            lipids_100g,
            default_portion_g,
            origin_countries,
        } = body

        if (!name_standard || !category || calories_per_100g === undefined) {
            return NextResponse.json({
                success: false,
                error: 'Champs obligatoires manquants'
            }, { status: 400 })
        }

        const rawName = name_standard.trim()
        const technicalSlug = `${slugify(rawName)}_${user.id.substring(0, 5)}`

        const { data, error } = await supabaseAdmin
            .from('food_items')
            .insert({
                name_standard: technicalSlug,
                display_name: display_name || rawName,
                category,
                calories_per_100g: Number(calories_per_100g),
                proteins_100g: Number(proteins_100g || 0),
                carbs_100g: Number(carbs_100g || 0),
                lipids_100g: Number(lipids_100g || 0),
                default_portion_g: Number(default_portion_g || 200),
                origin_countries: Array.isArray(origin_countries) ? origin_countries : [],
                verified: false,
                user_id: user.id
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ success: false, error: error.message })
        }

        return NextResponse.json({ success: true, data })

    } catch (err) {
        console.error('POST /api/foods error:', err)
        return NextResponse.json({ success: false, error: 'Erreur serveur' })
    }
}
