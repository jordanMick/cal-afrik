'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = 'BNfv7lFwqaZzo_KHZe6nmPCyVHse5lLyxy93uIlJql-1FiK0TDbXMEWCqHjszAuMxbUlZyIq-PE3UJy8Ci_vWAI'

export default function PushNotificationManager() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        }
    }, [])

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            })
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (err) {
            console.error('Service Worker registration failed:', err)
        }
    }

    async function subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            })

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ subscription: sub })
            })

            if (res.ok) {
                setSubscription(sub)
                console.log('Push subscription successful')
            }
        } catch (err) {
            console.error('Failed to subscribe from push:', err)
        }
    }

    if (!isSupported) return null

    // Si on n'est pas déjà abonné, on pourrait afficher un bandeau discret ou un bouton
    // Pour commencer, on va s'abonner automatiquement si on a la permission
    if (!subscription && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        subscribeToPush()
    }

    return (
        <>
            {(!subscription || (typeof Notification !== 'undefined' && Notification.permission === 'default')) && (
                 <div style={{
                    background: 'linear-gradient(135deg, var(--accent), #10b981)',
                    padding: '16px 20px',
                    borderRadius: '20px',
                    marginBottom: '28px',
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 8px 30px rgba(var(--accent-rgb), 0.2)'
                 }}>
                    <div>
                        <p style={{ fontSize: '15px', fontWeight: '800', marginBottom: '4px' }}>🔔 Ne rate jamais tes objectifs !</p>
                        <p style={{ fontSize: '11px', opacity: 0.9 }}>Active les notifications pour recevoir des rappels et des conseils quotidiens.</p>
                    </div>
                    <button 
                        onClick={async () => {
                            const permission = await Notification.requestPermission()
                            if (permission === 'granted') subscribeToPush()
                        }}
                        style={{
                            background: '#fff',
                            color: 'var(--accent)',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        Activer les notifications
                    </button>
                 </div>
            )}
        </>
    )
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}
