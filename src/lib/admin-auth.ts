import { NextRequest } from 'next/server'
import { createClient, type User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'jomickeal11@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

export function getAccessToken(req: NextRequest) {
    const auth = req.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
        return auth.substring(7)
    }

    return req.cookies.get('supabase-auth-token')?.value || null
}

export async function getAuthenticatedUser(req: NextRequest): Promise<User | null> {
    const token = getAccessToken(req)
    if (!token) return null

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null

    return user
}

export async function isAdminUser(user: User) {
    if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        return true
    }

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

    return !!profile?.is_admin
}

export async function requireAdmin(req: NextRequest) {
    const user = await getAuthenticatedUser(req)
    if (!user) return null

    return await isAdminUser(user) ? user : null
}
