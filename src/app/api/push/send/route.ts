import { NextRequest, NextResponse } from 'next/server'
import * as webpush from 'web-push'
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

        // Récupérer tous les abonnements AVEC les préférences
        const { data: subs, error } = await supabase
            .from('push_subscriptions')
            .select('*, profile:user_profiles(notify_meals, notify_reports, notify_subscription, subscription_tier, subscription_expires_at)')

        if (error) throw error

        let successCount = 0
        const failures: any[] = []

        const now = new Date()
        const hour = (now.getUTCHours() + 1) % 24 // UTC+1 pour l'Afrique de l'Ouest (Ajustable selon besoin)
        
        let slotTitle = 'Cal-Afrik 🥥'
        let slotBody = 'N\'oublie pas de scanner ton repas pour rester sur la bonne voie !'

        if (hour >= 5 && hour < 11) {
            slotTitle = 'Petit-déjeuner ☕'
            slotBody = 'C\'est l\'heure du petit-déjeuner ! Un bon début pour tes objectifs.'
        } else if (hour >= 12 && hour < 15) {
            slotTitle = 'Déjeuner 🍛'
            slotBody = 'Bon appétit ! Qu\'est-ce qu\'on mange pour le déjeuner ?'
        } else if (hour >= 16 && hour < 18) {
            slotTitle = 'Goûter 🍎'
            slotBody = 'Un petit creux ? Pense à scanner ton goûter.'
        } else if (hour >= 19 && hour < 22) {
            slotTitle = 'Dîner 🍲'
            slotBody = 'C\'est l\'heure du dîner ! Une dernière étape pour aujourd\'hui.'
        } else if (hour >= 22) {
            slotTitle = 'Bilan de Soirée 🏆'
            slotBody = 'Coach Yao a analysé ta journée. Viens découvrir ton score !'
        }

        const isBilan = hour >= 22;
        const notifUrl = isBilan ? '/dashboard' : '/scanner';

        const payload = JSON.stringify({
            title: slotTitle,
            body: slotBody,
            url: notifUrl
        })

        // Construction des envois
        const pushesToSend: { subscription: any, payload: string, user_id: string, id: string }[] = []

        subs.forEach((s: any) => {
            // 1. Notification de routine (Repas ou Bilan)
            const wantsRoutine = isBilan ? (s.profile?.notify_reports !== false) : (s.profile?.notify_meals !== false)
            if (wantsRoutine) {
                pushesToSend.push({ subscription: s.subscription, payload, user_id: s.user_id, id: s.id })
            }

            // 2. Notification d'abonnement (le matin uniquement, pour éviter le spam)
            if (hour >= 5 && hour < 11 && s.profile?.notify_subscription !== false) {
                const expiresAt = s.profile?.subscription_expires_at ? new Date(s.profile.subscription_expires_at) : null
                if (expiresAt && s.profile?.subscription_tier !== 'free') {
                    const diffTime = expiresAt.getTime() - now.getTime()
                    const daysLeft = Math.ceil(diffTime / (1000 * 3600 * 24))
                    
                    if (daysLeft === 3) {
                        pushesToSend.push({
                            subscription: s.subscription,
                            user_id: s.user_id,
                            id: s.id,
                            payload: JSON.stringify({
                                title: 'Attention 🔔',
                                body: 'Ton abonnement Premium expire dans 3 jours !',
                                url: '/settings/subscription'
                            })
                        })
                    } else if (daysLeft <= 0 && daysLeft >= -1) {
                        // On alerte si c'est aujourd'hui ou hier max pour ne pas spammer tous les jours
                        pushesToSend.push({
                            subscription: s.subscription,
                            user_id: s.user_id,
                            id: s.id,
                            payload: JSON.stringify({
                                title: 'Abonnement expiré 😕',
                                body: 'Renouvelle vite pour ne pas perdre l\'accès illimité à Coach Yao !',
                                url: '/settings/subscription'
                            })
                        })
                    }
                }
            }
        })

        // Envoi parallèle
        await Promise.all(pushesToSend.map(async (push) => {
            try {
                await webpush.sendNotification(push.subscription, push.payload)
                successCount++
            } catch (err: any) {
                console.error('Push error for user:', push.user_id, err)
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', push.id)
                }
                failures.push({ user: push.user_id, error: err.message })
            }
        }))

        return NextResponse.json({ 
            success: true, 
            sent: successCount, 
            filtered: subs.length - activeSubs.length,
            failed: failures.length,
            details: failures 
        })

    } catch (err: any) {
        console.error('Send push error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
