import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
}

// PATCH /api/user/weight — met à jour uniquement weight_kg
export async function PATCH(req: NextRequest) {
    try {
        const user = await getUser(req)
        if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const body = await req.json()
        const { weight_kg, calorie_target, protein_target_g, carbs_target_g, fat_target_g } = body

        if (weight_kg && (isNaN(weight_kg) || weight_kg < 20 || weight_kg > 300)) {
            return NextResponse.json({ success: false, error: 'Poids invalide' }, { status: 400 })
        }

        const updateData: any = { weight_kg: weight_kg ? parseFloat(weight_kg) : undefined }
        if (calorie_target) updateData.calorie_target = calorie_target
        if (protein_target_g) updateData.protein_target_g = protein_target_g
        if (carbs_target_g) updateData.carbs_target_g = carbs_target_g
        if (fat_target_g) updateData.fat_target_g = fat_target_g

        const { data, error } = await supabaseAdmin
            .from('user_profiles')
            .update(updateData)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            console.error('❌ Weight update error:', error)
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })

    } catch (err) {
        console.error('❌ PATCH /api/user/weight error:', err)
        return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
    }
}
