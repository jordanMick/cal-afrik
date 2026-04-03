import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('food_items')
            .select('*')
            // ❌ SUPPRIMÉ : .not('embedding', 'is', null)
            .limit(50)

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            })
        }

        return NextResponse.json({
            success: true,
            data
        })

    } catch (err) {
        return NextResponse.json({
            success: false,
            error: 'Erreur serveur'
        })
    }
}