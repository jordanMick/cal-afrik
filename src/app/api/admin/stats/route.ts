import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
    if (!await requireAdmin(req)) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    try {
        const { count: totalUsers } = await supabaseAdmin
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })

        const { count: premiumUsers } = await supabaseAdmin
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .neq('subscription_tier', 'free')

        const { count: totalScans } = await supabaseAdmin
            .from('meals')
            .select('*', { count: 'exact', head: true })
            .not('image_url', 'is', null)

        const { data: recentPayments } = await supabaseAdmin
            .from('payment_logs')
            .select('*')
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(10)

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
                revenueEstimate: 0
            },
            recentPayments: recentPayments || [],
            latestUsers: latestUsers || []
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
