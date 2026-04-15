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
                notify_meals: body.notify_meals,
                notify_hydration: body.notify_hydration,
                notify_reports: body.notify_reports,
                notify_subscription: body.notify_subscription,
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

export async function DELETE(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Supprimer en PREMIER l'utilisateur de l'auth (opération critique)
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

        // "User not found" = déjà supprimé de l'auth lors d'une tentative précédente → on continue le nettoyage
        if (deleteAuthError && !deleteAuthError.message?.toLowerCase().includes('not found')) {
            console.error('Delete auth error:', deleteAuthError)
            return NextResponse.json({ error: `Erreur lors de la suppression du compte: ${deleteAuthError.message}` }, { status: 500 })
        }

        // 2. Supprimer les données applicatives (indépendants — une erreur n'en bloque pas une autre)
        const tables = ['meals', 'weight_logs', 'user_profiles']
        for (const table of tables) {
            const { error: tableError } = await supabaseAdmin.from(table).delete().eq('user_id', user.id)
            if (tableError) console.warn(`Suppression ${table} ignorée:`, tableError.message)
        }

        // 3. Audit log optionnel (non-bloquant, on ignore si l'insertion échoue)
        try {
            await supabaseAdmin.from('account_deletions').insert({
                user_id: user.id,
                email: user.email,
                reason: 'Suppression manuelle par l\'utilisateur',
                deleted_at: new Date().toISOString()
            })
        } catch (auditError) {
            console.warn('Audit log suppression échoué:', auditError)
        }

        return NextResponse.json({ success: true, message: 'Compte supprimé avec succès' })

    } catch (err) {
        console.error('DELETE /api/user error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}