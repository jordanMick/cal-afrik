'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { ShieldAlert, Loader2 } from 'lucide-react'

const ADMIN_EMAILS = ['jomickeal11@gmail.com']

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [authorized, setAuthorized] = useState<boolean | null>(null)
    const router = useRouter()

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session) {
                router.push('/login')
                return
            }

            const email = session.user.email
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('is_admin')
                .eq('user_id', session.user.id)
                .single()

            if (ADMIN_EMAILS.includes(email!) || profile?.is_admin) {
                setAuthorized(true)
            } else {
                setAuthorized(false)
            }
        }
        checkAdmin()
    }, [router])

    if (authorized === null) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
            </div>
        )
    }

    if (authorized === false) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-6" />
                <h1 className="text-2xl font-black text-white mb-2">Accès Restreint</h1>
                <p className="text-gray-400 max-w-md">
                    Désolé, vous n'avez pas les permissions nécessaires pour accéder à l'interface d'administration.
                </p>
                <button 
                    onClick={() => router.push('/dashboard')}
                    className="mt-8 px-6 py-3 bg-white text-black rounded-xl font-bold"
                >
                    Retour au Dashboard
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-[#10b981] selection:text-black">
            {/* Sidebar / Header Simplifié pour l'admin */}
            <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-black">
                            A
                        </div>
                        <div>
                            <h1 className="font-black text-lg leading-none">Cal-Afrik Admin</h1>
                            <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest mt-1">Console de Contrôle</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => router.push('/dashboard')}
                        className="text-sm font-bold text-gray-400 hover:text-white transition-colors"
                    >
                        Quitter l'Admin
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                {children}
            </main>
        </div>
    )
}
