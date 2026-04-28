import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
    try {
        // 1. Tenter d'ajouter la colonne is_admin (ignore l'erreur si elle existe déjà)
        try {
            await supabaseAdmin.rpc('run_sql', { 
                sql: 'ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE' 
            })
        } catch (e) {
            console.log('SQL Migration might have failed or not supported via RPC:', e)
        }

        // 2. Promouvoir l'utilisateur jomickeal11@gmail.com
        // On récupère d'abord l'ID de l'utilisateur par son email
        const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()
        if (userError) throw userError

        const targetUser = users.users.find(u => u.email === 'jomickeal11@gmail.com')
        
        if (!targetUser) {
            return NextResponse.json({ error: 'Utilisateur jomickeal11@gmail.com non trouvé dans la base Auth.' })
        }

        const { error: updateError } = await supabaseAdmin
            .from('user_profiles')
            .update({ is_admin: true })
            .eq('user_id', targetUser.id)

        if (updateError) {
            // Si l'erreur est que la colonne n'existe pas, on renvoie une erreur spécifique
            if (updateError.message.includes('is_admin')) {
                return NextResponse.json({ 
                    error: "La colonne 'is_admin' n'existe pas encore. Veuillez l'ajouter manuellement dans le SQL Editor de Supabase: ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;" 
                })
            }
            throw updateError
        }

        return NextResponse.json({ 
            success: true, 
            message: `L'utilisateur ${targetUser.email} est maintenant ADMIN. Vous pouvez accéder à /admin` 
        })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
