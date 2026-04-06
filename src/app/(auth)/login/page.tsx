'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [isRegister, setIsRegister] = useState(false)

    const getSupabase = () => createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        try {
            const supabase = getSupabase()
            if (isRegister) {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) { setError(error.message); return }
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
                if (signInError) { setError(signInError.message); return }
                router.push('/onboarding')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) { setError(error.message); return }
                router.push('/dashboard')
            }
        } catch {
            setError('Une erreur est survenue')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Halos Cal AI */}
            <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-green-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

            <div className="w-full max-w-sm z-10 space-y-8">
                {/* LOGO SECTION */}
                <div className="text-center space-y-2">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-3"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-2xl shadow-lg shadow-green-500/20">
                            🌍
                        </div>
                        <span className="text-3xl font-black tracking-tighter text-white">Cal Afrik</span>
                    </motion.div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">L'IA au service de votre nutrition</p>
                </div>

                <Card className="border-white/5 bg-zinc-950/50 backdrop-blur-3xl shadow-2xl">
                    {/* TABS ÉLITE */}
                    <div className="flex p-1 bg-black rounded-full mb-8 border border-white/5">
                        {['Connexion', 'Inscription'].map((tab, i) => (
                            <button
                                key={tab}
                                onClick={() => { setIsRegister(i === 1); setError('') }}
                                className={cn(
                                    "flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all",
                                    isRegister === (i === 1) 
                                        ? "bg-white text-black shadow-lg" 
                                        : "text-white/30 hover:text-white/60"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nom@exemple.com"
                                    required
                                    className="w-full h-14 px-5 rounded-3xl bg-white/5 border border-white/5 text-white placeholder:text-white/10 focus:border-green-500/30 focus:bg-white/10 transition-all outline-none text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Mot de passe</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full h-14 px-5 rounded-3xl bg-white/5 border border-white/5 text-white placeholder:text-white/10 focus:border-green-500/30 focus:bg-white/10 transition-all outline-none text-sm"
                                />
                                <div className="text-right">
                                    <button 
                                        type="button" 
                                        onClick={() => {/* reset pass logic */}}
                                        className="text-[9px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-tight"
                                    >
                                        Mot de passe oublié ?
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        <Button 
                            type="submit" 
                            disabled={isLoading}
                            variant="primary"
                            fullWidth
                            className="bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/20"
                        >
                            {isLoading ? 'Chargement...' : isRegister ? "CRÉER MON COMPTE" : "SE CONNECTER"}
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-[10px] font-bold text-white/10 uppercase tracking-[0.2em] pt-4">
                    Cal Afrik • Made for Africa ❤️
                </p>
            </div>
        </div>
    )
}