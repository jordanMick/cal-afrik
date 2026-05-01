import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function isBootstrapEmailAllowed(email: string | undefined) {
    const allowed = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'jomickeal11@gmail.com')
        .trim()
        .toLowerCase()

    return !!email && email.toLowerCase() === allowed
}

export async function POST(req: NextRequest) {
    try {
        if (process.env.ENABLE_ADMIN_BOOTSTRAP !== 'true') {
            return NextResponse.json({
                error: "Bootstrap admin desactive. Active ENABLE_ADMIN_BOOTSTRAP=true temporairement pour l'utiliser."
            }, { status: 403 })
        }

        const user = await getAuthenticatedUser(req)
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
        }

        if (!isBootstrapEmailAllowed(user.email)) {
            return NextResponse.json({ error: 'Compte non autorise pour le bootstrap admin' }, { status: 403 })
        }

        const setupSecret = req.headers.get('x-admin-setup-secret')
        if (!setupSecret || setupSecret !== process.env.ADMIN_SETUP_SECRET) {
            return NextResponse.json({ error: 'Secret de bootstrap invalide' }, { status: 403 })
        }

        const { error: updateError } = await supabaseAdmin
            .from('user_profiles')
            .update({ is_admin: true })
            .eq('user_id', user.id)

        if (updateError) {
            if (updateError.message.includes('is_admin')) {
                return NextResponse.json({
                    error: "La colonne 'is_admin' n'existe pas encore. Ajoute-la d'abord dans Supabase."
                }, { status: 500 })
            }

            throw updateError
        }

        return NextResponse.json({
            success: true,
            message: `Le compte ${user.email} est maintenant administrateur. Desactive ensuite ENABLE_ADMIN_BOOTSTRAP.`
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
