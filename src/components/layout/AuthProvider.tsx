'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setProfile, setTodayMeals } = useAppStore()
    const router = useRouter()
    const pathname = usePathname()
    const mealsLoaded = useRef(false)

    useEffect(() => {
        initAuth()

        const { data: listener } = supabase.auth.onAuthStateChange((_event) => {
            // ✅ Ne recharger que sur login/logout réel
            if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
                mealsLoaded.current = false
                initAuth()
            }
        })

        return () => { listener.subscription.unsubscribe() }
    }, [])

    const initAuth = async () => {
        try {
            const { data, error } = await supabase.auth.getSession()
            if (error) { console.error('Erreur session:', error); return }

            const session = data.session

            if (!session) {
                if (
                    !pathname.startsWith('/login') &&
                    !pathname.startsWith('/onboarding') &&
                    !pathname.startsWith('/reset-password')
                ) {
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

            // ✅ Charger les repas UNE SEULE FOIS
            // Après un ajout, le store est mis à jour via addMeal() directement
            // Après une suppression, le store est mis à jour via removeMeal() directement
            // On ne recharge depuis Supabase qu'au premier démarrage ou après login
            if (!mealsLoaded.current) {
                mealsLoaded.current = true
                const today = new Date().toISOString().split('T')[0]
                const res = await fetch(`/api/meals?date=${today}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                })
                const json = await res.json()
                if (json.success) setTodayMeals(json.data)
            }

        } catch (err) {
            console.error('Erreur AuthProvider:', err)
        }
    }

    return <>{children}</>
}