'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const toLocalDateString = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setProfile, setTodayMeals } = useAppStore()
    const router = useRouter()
    const pathname = usePathname()
    const mealsLoaded = useRef(false)
    const [loading, setLoading] = useState(true)

    const initAuth = async () => {
        try {
            // 1. Première tentative immédiate
            const { data, error } = await supabase.auth.getSession()
            let session = data?.session

            // 2. Si pas de session, on patiente un peu (important sur mobile/PWA)
            // L'iPhone met parfois du temps à indexer le IndexedDB au démarrage de l'app
            if (!session) {
                await new Promise(resolve => setTimeout(resolve, 800))
                const { data: retryData } = await supabase.auth.getSession()
                session = retryData?.session
            }

            // 3. Si toujours rien, on fait une ultime tentative à 1.5s
            if (!session) {
                await new Promise(resolve => setTimeout(resolve, 700))
                const { data: finalData } = await supabase.auth.getSession()
                session = finalData?.session
            }

            if (!session) {
                // Cette fois on est sûr qu'il n'y a pas de session active
                if (!pathname.startsWith('/login') && !pathname.startsWith('/onboarding') && !pathname.startsWith('/reset-password')) {
                    console.log('--- Auth: No session found after retries, redirecting to login ---')
                    router.push('/login')
                    // Garder le loading pour éviter le flash
                    return 
                }
                setLoading(false)
                return
            }

            // ✅ Session trouvée ! On charge le profil
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single()

            if (profileError || !profile) {
                if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/login')) {
                    console.log('--- Auth: No profile found, redirecting to onboarding ---')
                    router.push('/onboarding')
                    // 🚨 On ne met PAS loading à false ici pour éviter le flash du Dashboard
                    return
                }
                setLoading(false)
                return
            }

            setProfile(profile)

            // ✅ Charger les repas (une seule fois pour éviter les flashs)
            if (!mealsLoaded.current) {
                mealsLoaded.current = true
                const today = toLocalDateString()
                const tzOffset = new Date().getTimezoneOffset()
                try {
                    const res = await fetch(`/api/meals?date=${today}&tz_offset_min=${tzOffset}`, {
                        headers: { Authorization: `Bearer ${session.access_token}` }
                    })
                    const json = await res.json()
                    if (json.success) setTodayMeals(json.data)
                } catch (mealErr) {
                    console.error('Error loading meals:', mealErr)
                }
            }
            
            setLoading(false)

        } catch (err) {
            console.error('AuthProvider critical error:', err)
            setLoading(false)
        }
    }

    useEffect(() => {
        initAuth()

        // S'abonner aux changements d'état (login/logout/refresh)
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                initAuth()
            }
            if (event === 'SIGNED_OUT') {
                setProfile(null)
                router.push('/login')
            }
        })

        return () => { listener.subscription.unsubscribe() }
    }, [])

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #141414', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    return <>{children}</>
}