import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        // 1. Récupérer l'user
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
        if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        // 2. Vider les messages payants (fin de session de suggestion)
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ 
                paid_chat_messages_remaining: 0,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('❌ Consume session error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
