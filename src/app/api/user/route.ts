import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
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

        const { data: existingProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()

        const updateData = {
            user_id: user.id,
            name: body.name ?? existingProfile?.name,
            age: body.age ?? existingProfile?.age,
            gender: body.gender ?? existingProfile?.gender,
            weight_kg: body.weight_kg ?? existingProfile?.weight_kg,
            height_cm: body.height_cm ?? existingProfile?.height_cm,
            activity_level: body.activity_level ?? existingProfile?.activity_level,
            goal: body.goal ?? existingProfile?.goal,
            calorie_target: body.calorie_target ?? existingProfile?.calorie_target,
            protein_target_g: body.protein_target_g ?? existingProfile?.protein_target_g,
            carbs_target_g: body.carbs_target_g ?? existingProfile?.carbs_target_g,
            fat_target_g: body.fat_target_g ?? existingProfile?.fat_target_g,
            preferred_cuisines: body.preferred_cuisines ?? existingProfile?.preferred_cuisines,
            dietary_restrictions: body.dietary_restrictions ?? existingProfile?.dietary_restrictions,
            language: body.language || existingProfile?.language || 'fr',
            country: body.country ?? existingProfile?.country,
            onboarding_done: true,
            notify_meals: body.notify_meals !== undefined ? body.notify_meals : existingProfile?.notify_meals,
            notify_hydration: body.notify_hydration !== undefined ? body.notify_hydration : existingProfile?.notify_hydration,
            notify_reports: body.notify_reports !== undefined ? body.notify_reports : existingProfile?.notify_reports,
            notify_subscription: body.notify_subscription !== undefined ? body.notify_subscription : existingProfile?.notify_subscription,
        }

        const { data: profile, error } = await supabaseAdmin
            .from('user_profiles')
            .upsert(updateData, { onConflict: 'user_id' })
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

        // 1. Supprimer les données applicatives AVANT le compte Auth
        // On liste toutes les tables connues liées au user_id
        const tables = [
            'push_subscriptions', 
            'notifications', 
            'food_items', 
            'meals', 
            'weight_logs', 
            'account_deletions',
            'user_profiles'
        ]

        for (const table of tables) {
            try {
                const { error: tableError } = await supabaseAdmin.from(table).delete().eq('user_id', user.id)
                if (tableError) {
                    console.warn(`[Cleanup] Échec suppression table ${table}:`, tableError.message)
                }
            } catch (tableErr) {
                console.warn(`[Cleanup] Exception table ${table}:`, tableErr)
            }
        }

        // 2. Audit log optionnel (on le met dans le cleanup ou séparé, ici on l'a déjà mis dans la boucle)
        // Note: On peut aussi insérer un log final si besoin avant de supprimer l'utilisateur de l'auth

        // 3. EN DERNIER : Supprimer l'utilisateur de l'auth
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

        // "User not found" = déjà supprimé ou erreur mineure
        if (deleteAuthError && !deleteAuthError.message?.toLowerCase().includes('not found')) {
            console.error('Delete auth error:', deleteAuthError)
            return NextResponse.json({ 
                error: `Erreur critique lors de la suppression finale: ${deleteAuthError.message}. Vos données ont été partiellement nettoyées.` 
            }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Compte supprimé avec succès' })

    } catch (err) {
        console.error('DELETE /api/user error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
