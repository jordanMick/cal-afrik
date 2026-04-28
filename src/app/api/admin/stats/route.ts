import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['jomickeal11@gmail.com']

async function verifyAdmin(req: NextRequest) {
    let token = req.cookies.get('supabase-auth-token')?.value
    if (!token) {
        const auth = req.headers.get('authorization')
        if (auth?.startsWith('Bearer ')) token = auth.substring(7)
    }
    if (!token) return false

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return false

    if (ADMIN_EMAILS.includes(user.email!)) return true

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

    return !!profile?.is_admin
}

export async function GET(req: NextRequest) {
    if (!await verifyAdmin(req)) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    try {
        // 1. Stats Utilisateurs
        const { count: totalUsers } = await supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true })
        const { count: premiumUsers } = await supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).neq('subscription_tier', 'free')

        // 2. Stats Scans (via la table meals avec image_url)
        const { count: totalScans } = await supabaseAdmin.from('meals').select('*', { count: 'exact', head: true }).not('image_url', 'is', null)

        // 3. Revenus Récents (Paiements réussis)
        const { data: recentPayments } = await supabaseAdmin
            .from('payment_logs')
            .select('*')
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(10)

        // 4. Derniers Utilisateurs
        const { data: latestUsers } = await supabaseAdmin
            .from('user_profiles')
            .select('name, email, subscription_tier, created_at, avatar_url')
            .order('created_at', { ascending: false })
            .limit(10)

        return NextResponse.json({
            success: true,
            stats: {
                totalUsers: totalUsers || 0,
                premiumUsers: premiumUsers || 0,
                totalScans: totalScans || 0,
                revenueEstimate: 0 // À calculer si besoin
            },
            recentPayments: recentPayments || [],
            latestUsers: latestUsers || []
        })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
