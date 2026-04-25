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
            // 1. Première tentative immédiate (cas le plus fréquent)
            const { data } = await supabase.auth.getSession()
            let session = data?.session

            // 2. Si pas de session, on ne patiente QUE si on est sur mobile/PWA
            // et seulement pour une fraction de seconde, pas 1.5s d'office.
            if (!session) {
                const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
                if (isPWA) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                    const { data: retryData } = await supabase.auth.getSession()
                    session = retryData?.session
                }
            }

            if (!session) {
                // Toujours pas de session ? On vérifie si on est sur une page protégée
                const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/onboarding') || pathname.startsWith('/reset-password')
                
                if (!isAuthPage) {
                    router.push('/login')
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

            // ✅ Mettre en place l'abonnement direct à la base de données (Temps réel)
            if (!(window as any)._profileSubscribed && session.user.id) {
                ;(window as any)._profileSubscribed = true
                supabase.channel('global_profile_updates')
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${session.user.id}` }, (payload) => {
                        console.log('[Realtime] Modif profil détectée:', payload.new)
                        useAppStore.getState().setProfile(payload.new as any)
                    })
                    .subscribe()
            }

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
            <div className="loading-container">
                <div className="spinner" />
            </div>
        )
    }

    return <>{children}</>
}