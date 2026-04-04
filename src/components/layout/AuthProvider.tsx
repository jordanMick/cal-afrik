'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setProfile, setTodayMeals } = useAppStore()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        initAuth()

        const { data: listener } = supabase.auth.onAuthStateChange(() => {
            initAuth()
        })

        return () => { listener.subscription.unsubscribe() }
    }, [])

    const initAuth = async () => {
        try {
            const { data, error } = await supabase.auth.getSession()
            if (error) { console.error('Erreur session:', error); return }

            const session = data.session

            if (!session) {
                if (!pathname.startsWith('/login') && !pathname.startsWith('/onboarding')) {
                    router.push('/login')
                }
                return
            }

            // ✅ Charger le profil
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single()

            if (profileError || !profile) {
                router.push('/onboarding')
                return
            }

            setProfile(profile)

            // ✅ Charger les repas du jour une seule fois pour toutes les pages
            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/meals?date=${today}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setTodayMeals(json.data)

        } catch (err) {
            console.error('Erreur AuthProvider:', err)
        }
    }

    return <>{children}</>
}