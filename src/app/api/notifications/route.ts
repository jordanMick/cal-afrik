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

// 🔔 GET : Récupérer les notifications de l'utilisateur
export async function GET(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true, data })

    } catch (err) {
        console.error('GET /api/notifications error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// ✍️ POST : Créer une notification (depuis les Smart Alerts)
export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { type, title, message } = await req.json()

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Eviter de créer un double pour le même jour
        const todayStr = new Date().toISOString().split('T')[0]
        const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', title)
            .gte('created_at', `${todayStr}T00:00:00Z`)
            .limit(1)
            .single()

        if (!existing) {
            await supabase.from('notifications').insert({
                user_id: user.id,
                type,
                title,
                message,
                created_at: new Date().toISOString()
            })
        }

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error('POST /api/notifications error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// ✅ PATCH : Marquer comme lues
export async function PATCH(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { ids } = await req.json() // Liste d'IDs à marquer comme lues

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .in('id', ids)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error('PATCH /api/notifications error:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// 🗑️ DELETE : Supprimer (optionnel)
export async function DELETE(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const { id } = await req.json()

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
