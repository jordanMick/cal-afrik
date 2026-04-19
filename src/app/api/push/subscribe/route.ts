import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getUser(req: NextRequest) {
    const auth = req.headers.get('authorization')
    const token = auth?.startsWith('Bearer ') ? auth.substring(7) : null
    if (!token) return null

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
}

// 📲 POST : Enregistrer un abonnement push
export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { subscription } = await req.json()

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Upsert : On écrase l'ancien abonnement si l'utilisateur change d'appareil (ou on en ajoute un nouveau)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                subscription: subscription,
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error('POST /api/push/subscribe error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
