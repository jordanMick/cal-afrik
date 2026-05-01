import { NextRequest, NextResponse } from 'next/server'
import * as webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function configureWebPush() {
    const subject = process.env.WEB_PUSH_SUBJECT
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!subject || !publicKey || !privateKey) {
        throw new Error('Configuration Web Push manquante')
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)
}

// 🤖 GET : Appel par le CRON Job (avec secret sécurisé)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')

    if (!secret || secret !== process.env.PUSH_CRON_SECRET) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    return handlePushSending()
}

// 👨‍💻 POST : Appel manuel par l'admin
export async function POST(req: NextRequest) {
    if (!await requireAdmin(req)) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    return handlePushSending()
}

async function handlePushSending() {

    try {
        configureWebPush()

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: rawSubs, error: subsError } = await supabase
            .from('push_subscriptions')
            .select('*')

        if (subsError) throw subsError

        const userIds = [...new Set((rawSubs || []).map((s: any) => s.user_id))]
        const { data: profiles, error: profError } = await supabase
            .from('user_profiles')
            .select('user_id, notify_meals, notify_reports, notify_subscription, subscription_tier, subscription_expires_at')
            .in('user_id', userIds)

        if (profError) throw profError

        const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]))
        const subs = (rawSubs || []).map((s: any) => ({
            ...s,
            profile: profileMap[s.user_id]
        }))

        let successCount = 0
        const failures: Array<{ user: string, error: string }> = []

        const now = new Date()
        const hour = now.getUTCHours()

        let slotTitle = ''
        let slotBody = ''
        let isRoutine = true

        if (hour === 8) {
            slotTitle = 'Petit-dejeuner'
            slotBody = "C'est l'heure du petit-dejeuner ! Un bon debut pour tes objectifs."
        } else if (hour === 12) {
            slotTitle = 'Dejeuner'
            slotBody = "Bon appetit ! C'est l'heure du dejeuner. Qu'est-ce qu'on mange ?"
        } else if (hour === 16) {
            slotTitle = 'Collation'
            slotBody = "L'heure du gouter ! Pense a enregistrer ton petit plaisir."
        } else if (hour === 19) {
            slotTitle = 'Diner'
            slotBody = "C'est l'heure du diner ! On termine la journee en beaute."
        } else if (hour === 22) {
            slotTitle = 'Bilan de soiree'
            slotBody = 'Ton bilan est pret ! Coach Yao a analyse ta journee.'
        } else {
            isRoutine = false
        }

        if (!isRoutine) {
            return NextResponse.json({ success: true, message: `Rien a envoyer a ${hour}h` })
        }

        const isBilan = hour === 22
        const notifUrl = isBilan ? '/dashboard' : '/scanner'

        const payload = JSON.stringify({
            title: slotTitle,
            body: slotBody,
            url: notifUrl
        })

        const pushesToSend: Array<{ subscription: any, payload: string, user_id: string, id: string }> = []

        subs.forEach((s: any) => {
            const wantsRoutine = isBilan ? (s.profile?.notify_reports !== false) : (s.profile?.notify_meals !== false)
            if (wantsRoutine) {
                pushesToSend.push({ subscription: s.subscription, payload, user_id: s.user_id, id: s.id })
            }

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
                                title: 'Attention',
                                body: 'Ton abonnement Premium expire dans 3 jours !',
                                url: '/settings/subscription'
                            })
                        })
                    } else if (daysLeft <= 0 && daysLeft >= -1) {
                        pushesToSend.push({
                            subscription: s.subscription,
                            user_id: s.user_id,
                            id: s.id,
                            payload: JSON.stringify({
                                title: 'Abonnement expire',
                                body: "Renouvelle vite pour ne pas perdre l'acces illimite a Coach Yao !",
                                url: '/settings/subscription'
                            })
                        })
                    }
                }
            }
        })

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
            filtered: subs.length - pushesToSend.length,
            failed: failures.length,
            details: failures
        })
    } catch (err: any) {
        console.error('Send push error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
