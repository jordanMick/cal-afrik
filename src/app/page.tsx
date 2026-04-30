'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Sparkles, CheckCircle2, ChevronRight, AlertCircle, Upload, Clock, Star } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        let interval: any
        if (isAnalyzing) {
            setProgress(0)
            interval = setInterval(() => {
                setProgress(prev => (prev >= 95 ? 95 : prev + 5))
            }, 100)
            return () => clearInterval(interval)
        }
    }, [isAnalyzing])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsAnalyzing(true); setError(null); setAnalysisResult(null)
        try {
            const base64 = await toBase64(file)
            const res = await fetch('/api/demo/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: { data: base64, mimeType: file.type } })
            })
            const data = await res.json()
            setTimeout(() => {
                setProgress(100)
                if (data.success && data.items.length > 0) setAnalysisResult(data)
                else setError(data.success ? "Plat non reconnu." : "Erreur d'analyse.")
                setIsAnalyzing(false)
            }, 1000)
        } catch { setError("Erreur réseau."); setIsAnalyzing(false) }
    }

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result!.toString().split(',')[1])
        reader.onerror = reject
    })

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* Header style mockup */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#10b981] rounded-lg flex items-center justify-center font-bold text-lg">
                            CA
                        </div>
                        <span className="text-xl font-bold tracking-tight font-display">Cal Afrik</span>
                    </div>
                    <Link href="/login" className="px-6 py-2.5 border border-white/20 rounded-xl text-sm font-medium hover:bg-white/5 transition-all">
                        Ouvrir Cal Afrik
                    </Link>
                </div>
            </nav>

            <main className="pt-40 pb-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Badge Pill */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center px-6 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-[#10b981] text-sm font-medium mb-12"
                    >
                        IA Yao — Analyse nutritionnelle africaine
                    </motion.div>

                    {/* Hero section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                    >
                        <h1 className="text-5xl md:text-[64px] font-bold tracking-tight mb-8 leading-[1.1] font-display">
                            Boostez votre santé grâce au <br />
                            <span className="text-[#10b981]/80">scanner intelligent.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-white/60 mb-16 max-w-2xl mx-auto leading-relaxed">
                            Analysez vos plats africains en une photo. Sans effort, avec l'IA Yao.
                        </p>

                        {/* Action Bar (Mockup style) */}
                        <div className="relative max-w-2xl mx-auto mb-10">
                            {!isAnalyzing && !analysisResult && !error && (
                                <div className="flex items-center p-1.5 bg-[#1f1f1f] rounded-2xl border border-white/10">
                                    <div className="flex-1 px-5 text-left text-white/40 text-base md:text-lg truncate">
                                        Prenez une photo de votre plat...
                                    </div>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-8 py-3 bg-[#131313] border border-white/10 text-white rounded-xl font-medium hover:bg-white/5 transition-all"
                                    >
                                        Scanner
                                    </button>
                                </div>
                            )}

                            {/* Loading State */}
                            {isAnalyzing && (
                                <div className="bg-[#1a1a1a] p-8 rounded-3xl border border-white/5">
                                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-4">
                                        <motion.div 
                                            className="h-full bg-emerald-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Analyse en cours...</p>
                                </div>
                            )}

                            {/* Result State */}
                            <AnimatePresence>
                                {analysisResult && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-[#1a1a1a] rounded-3xl p-10 border border-white/10 text-left shadow-2xl"
                                    >
                                        <div className="flex items-center gap-2 text-emerald-500 mb-8 font-bold text-sm uppercase tracking-widest">
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span>Résultat prêt</span>
                                        </div>
                                        
                                        <div className="flex flex-col md:flex-row items-center gap-12 mb-10">
                                            <div className="text-center md:text-left">
                                                <div className="text-7xl font-bold text-white mb-2">{analysisResult.total_summary.calories}</div>
                                                <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.3em]">Calories</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-8 flex-1 w-full border-l border-white/5 pl-10">
                                                <div>
                                                    <div className="text-xl font-bold text-white">{analysisResult.total_summary.proteins}g</div>
                                                    <div className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Protéines</div>
                                                </div>
                                                <div>
                                                    <div className="text-xl font-bold text-white">{analysisResult.total_summary.carbs}g</div>
                                                    <div className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Glucides</div>
                                                </div>
                                                <div>
                                                    <div className="text-xl font-bold text-white">{analysisResult.total_summary.lipids}g</div>
                                                    <div className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Lipides</div>
                                                </div>
                                            </div>
                                        </div>

                                        <Link href="/login?mode=register" className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-white/90 transition-all">
                                            Voir le détail + 5 scans gratuits
                                            <ChevronRight className="w-5 h-5" />
                                        </Link>
                                        
                                        <button onClick={() => setAnalysisResult(null)} className="mt-6 w-full text-center text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
                                            Réanalyser
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Error state */}
                            {error && (
                                <div className="bg-[#1a1a1a] p-10 rounded-3xl border border-red-500/20">
                                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p className="text-white/60 mb-8 font-medium">{error}</p>
                                    <button onClick={() => setError(null)} className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl font-bold">
                                        Réessayer
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Secondary CTA */}
                        <div className="flex flex-col items-center gap-5">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-10 py-3.5 bg-transparent border border-white/20 rounded-xl font-medium text-lg hover:bg-white/5 transition-all"
                            >
                                Commencer gratuitement
                            </button>
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Aucune carte bancaire requise</p>
                        </div>

                        {/* Hidden input */}
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                    </motion.div>

                    {/* Divider */}
                    <div className="h-px bg-white/5 w-full my-16 max-w-2xl mx-auto" />

                    {/* Features Grid style mockup */}
                    <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                                <Clock className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Vision AI</span>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                                <Upload className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Sync Coach</span>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                                <Star className="w-6 h-6" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Yao</span>
                        </div>
                    </div>

                    <div className="mt-20">
                        <Link href="#" className="text-xs font-bold text-emerald-500/80 hover:text-emerald-400 transition-colors underline underline-offset-8 decoration-emerald-500/30">Voir plus d'applications</Link>
                    </div>
                </div>
            </main>

            {/* Footer style mockup */}
            <footer className="mt-12 py-10 border-t border-white/5 text-center">
                <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
                    <div className="flex gap-8 text-[11px] font-medium text-white/40">
                        <Link href="/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Conditions</Link>
                        <Link href="#" className="hover:text-white transition-colors">Contact</Link>
                    </div>
                    <p className="text-[10px] font-medium text-white/20 uppercase tracking-[0.3em]">© 2026 Cal Afrik</p>
                </div>
            </footer>
        </div>
    )
}
