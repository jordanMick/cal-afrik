'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = 'BNfv7lFwqaZzo_KHZe6nmPCyVHse5lLyxy93uIlJql-1FiK0TDbXMEWCqHjszAuMxbUlZyIq-PE3UJy8Ci_vWAI'

export default function PushNotificationManager() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default')

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermissionStatus(Notification.permission)
        }
        
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
            
            if (sub) {
                console.log('Push subscription found, syncing with server...')
                setSubscription(sub)
                setPermissionStatus('granted')
                // Synchroniser systématiquement avec le serveur au chargement
                syncSubscriptionWithServer(sub)
            } else if (Notification.permission === 'granted') {
                console.log('Permission granted but no subscription, subscribing...')
                subscribeToPush()
            }
        } catch (err) {
            console.error('Service Worker registration failed:', err)
        }
    }

    async function syncSubscriptionWithServer(sub: PushSubscription) {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ subscription: sub })
            })
        } catch (err) {
            console.error('Failed to sync push subscription:', err)
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
                setPermissionStatus('granted')
                console.log('Push subscription successful')
            }
        } catch (err) {
            console.error('Failed to subscribe from push:', err)
        }
    }

    if (!isSupported) return null

    // Si on a déjà refusé ou autorisé, on n'affiche plus le bandeau
    if (permissionStatus !== 'default') return null

    return (
        <>
            <div style={{
                background: 'var(--bg-secondary)',
                padding: '24px',
                borderRadius: '24px',
                marginBottom: '28px',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />
                
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        🔔
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Ne rate jamais tes objectifs !</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '2px' }}>Active les notifications pour recevoir des rappels et des conseils personnalisés.</p>
                    </div>
                </div>

                <button 
                    onClick={async () => {
                        const permission = await Notification.requestPermission()
                        setPermissionStatus(permission)
                        if (permission === 'granted') subscribeToPush()
                    }}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent), var(--success))',
                        color: '#fff',
                        border: 'none',
                        padding: '14px',
                        borderRadius: '14px',
                        fontSize: '14px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(var(--accent-rgb), 0.2)'
                    }}
                >
                    Activer les notifications
                </button>
            </div>
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
