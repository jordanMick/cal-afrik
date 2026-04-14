import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
    'mailto:contact@cal-afrik.com',
    'BNfv7lFwqaZzo_KHZe6nmPCyVHse5lLyxy93uIlJql-1FiK0TDbXMEWCqHjszAuMxbUlZyIq-PE3UJy8Ci_vWAI',
    'X7Ar5GPmj-iXaJWadrKgowvIZfYtcDKbJ9LnKlCvoiY'
)

// 🚀 GET /api/push/send (Pour test manuel ou CRON)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const secret = searchParams.get('secret')

        // Protection par secret simple pour le test
        if (secret !== 'cal_afrik_push_2024') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Récupérer tous les abonnements
        const { data: subs, error } = await supabase
            .from('push_subscriptions')
            .select('*')

        if (error) throw error

        let successCount = 0
        const failures: any[] = []

        const payload = JSON.stringify({
            title: 'Cal-Afrik 🥥',
            body: 'N\'oublie pas de scanner ton repas pour rester sur la bonne voie !',
            url: '/scanner'
        })

        // Envoi parallèle
        await Promise.all(subs.map(async (s) => {
            try {
                await webpush.sendNotification(s.subscription, payload)
                successCount++
            } catch (err: any) {
                console.error('Push error for user:', s.user_id, err)
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Supprimer l'abonnement expiré
                    await supabase.from('push_subscriptions').delete().eq('id', s.id)
                }
                failures.push({ user: s.user_id, error: err.message })
            }
        }))

        return NextResponse.json({ 
            success: true, 
            sent: successCount, 
            failed: failures.length,
            details: failures 
        })

    } catch (err: any) {
        console.error('Send push error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
