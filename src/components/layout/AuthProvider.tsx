'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setProfile } = useAppStore()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        initAuth()

        // 🔥 écoute les changements auth (important)
        const { data: listener } = supabase.auth.onAuthStateChange(() => {
            initAuth()
        })

        return () => {
            listener.subscription.unsubscribe()
        }

    }, [])

    const initAuth = async () => {
        try {
            const { data, error } = await supabase.auth.getSession()

            if (error) {
                console.error('Erreur session:', error)
                return
            }

            const session = data.session

            // ❌ pas connecté
            if (!session) {
                if (
                    !pathname.startsWith('/login') &&
                    !pathname.startsWith('/onboarding')
                ) {
                    router.push('/login')
                }
                return
            }

            // ✅ connecté → récupérer profile
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single()

            // 🔥 si pas de profile → onboarding
            if (profileError || !profile) {
                router.push('/onboarding')
                return
            }

            // ✅ stocker dans Zustand
            setProfile(profile)

        } catch (err) {
            console.error('Erreur AuthProvider:', err)
        }

    }

    return <>{children}</>
}