'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Sparkles, CheckCircle2, ChevronRight, AlertCircle, Upload } from 'lucide-react'
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
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-100">
            {/* Header style taap.it */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                            <div className="w-9 h-9 bg-[#00d084] rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900 font-display">Cal Afrik</span>
                        </div>
                        <div className="hidden md:flex items-center gap-8 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
                            <Link href="#" className="hover:text-emerald-500 transition-colors">Produit</Link>
                            <Link href="#" className="hover:text-emerald-500 transition-colors">Tarifs</Link>
                            <Link href="#" className="hover:text-emerald-500 transition-colors">F.A.Q</Link>
                        </div>
                    </div>
                    <Link href="/login" className="px-6 py-3 bg-[#00d084] text-white rounded-xl text-[13px] font-black uppercase tracking-widest hover:bg-[#00ba76] transition-all shadow-xl shadow-emerald-100 hover:-translate-y-0.5 active:translate-y-0">
                        Ouvrir Cal Afrik
                    </Link>
                </div>
            </nav>

            <main className="pt-44 pb-32 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    {/* Hero section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.05] font-display">
                            Boostez votre santé grâce au <br />
                            <span className="text-[#00d084]">scanner intelligent.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-400 mb-16 font-medium max-w-2xl mx-auto">
                            Analysez vos plats africains en une photo. <br className="hidden md:block" /> Sans effort, avec l'IA Yao.
                        </p>

                        {/* Action Bar (Input style) */}
                        <div className="relative max-w-2xl mx-auto mb-10">
                            {!isAnalyzing && !analysisResult && !error && (
                                <div className="group flex items-center p-2 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 hover:border-emerald-200 transition-all">
                                    <div className="flex-1 px-6 text-left text-slate-300 text-base font-bold truncate uppercase tracking-widest">
                                        Prenez une photo de votre plat...
                                    </div>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-10 py-4 bg-[#00d084] text-white rounded-2xl font-black text-xl hover:bg-[#00ba76] transition-all shadow-xl shadow-emerald-100 group-hover:scale-[1.02] active:scale-95"
                                    >
                                        SCAN
                                    </button>
                                </div>
                            )}

                            {/* Loading State */}
                            {isAnalyzing && (
                                <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-slate-50">
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6">
                                        <motion.div 
                                            className="h-full bg-[#00d084]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm font-black text-[#00d084] animate-pulse uppercase tracking-[0.3em]">
                                        Analyse Yao en cours...
                                    </p>
                                </div>
                            )}

                            {/* Result State */}
                            <AnimatePresence>
                                {analysisResult && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-white rounded-[40px] p-10 shadow-[0_30px_100px_rgba(0,0,0,0.1)] border border-slate-50 text-left"
                                    >
                                        <div className="flex items-center gap-3 text-[#00d084] mb-8 font-black uppercase tracking-widest text-sm">
                                            <CheckCircle2 className="w-6 h-6" />
                                            <span>Résultat prêt !</span>
                                        </div>
                                        
                                        <div className="flex flex-col md:flex-row items-center gap-12 mb-10">
                                            <div className="text-center md:text-left">
                                                <div className="text-8xl font-black text-slate-900 leading-none mb-2">{analysisResult.total_summary.calories}</div>
                                                <div className="text-xs text-slate-300 font-black uppercase tracking-[0.2em]">Calories Estimées</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-8 flex-1 w-full border-l border-slate-100 pl-12 hidden md:grid">
                                                <div>
                                                    <div className="text-2xl font-black text-slate-900">{analysisResult.total_summary.proteins}g</div>
                                                    <div className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Protéines</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-black text-slate-900">{analysisResult.total_summary.carbs}g</div>
                                                    <div className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Glucides</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-black text-slate-900">{analysisResult.total_summary.lipids}g</div>
                                                    <div className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Lipides</div>
                                                </div>
                                            </div>
                                        </div>

                                        <Link href="/login?mode=register" className="w-full py-5 bg-[#00d084] text-white rounded-[24px] font-black text-xl flex items-center justify-center gap-3 hover:bg-[#00ba76] transition-all shadow-2xl shadow-emerald-100">
                                            Voir l'analyse détaillée + 5 scans offerts
                                            <ChevronRight className="w-6 h-6" />
                                        </Link>
                                        
                                        <button onClick={() => setAnalysisResult(null)} className="mt-8 w-full text-center text-xs text-slate-300 font-black hover:text-slate-500 transition-colors uppercase tracking-[0.2em]">
                                            Réanalyser un plat
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Error state */}
                            {error && (
                                <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-red-50">
                                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                                    <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase tracking-tight">Erreur d'analyse</h3>
                                    <p className="text-slate-400 mb-10 font-bold">{error}</p>
                                    <button onClick={() => setError(null)} className="px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                                        Réessayer
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Secondary CTA */}
                        <div className="flex flex-col items-center gap-6">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-12 py-5 bg-[#00d084] text-white rounded-3xl font-black text-2xl hover:bg-[#00ba76] transition-all shadow-2xl shadow-emerald-100 hover:-translate-y-1 active:translate-y-0"
                            >
                                Commencer gratuitement
                            </button>
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Aucune carte bancaire requise</p>
                        </div>

                        {/* Hidden input */}
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                    </motion.div>

                    {/* Platform Icons style taap.it */}
                    <div className="mt-32 flex flex-wrap justify-center items-center gap-16 opacity-20">
                        <div className="flex flex-col items-center gap-4">
                            <Camera className="w-8 h-8" />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Vision AI</span>
                        </div>
                        <div className="flex flex-col items-center gap-4">
                            <Upload className="w-8 h-8" />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Instant Sync</span>
                        </div>
                        <div className="flex flex-col items-center gap-4">
                            <Sparkles className="w-8 h-8" />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Coach Yao</span>
                        </div>
                    </div>

                    <div className="mt-16">
                        <Link href="#" className="text-xs font-black text-slate-300 hover:text-slate-900 transition-colors uppercase tracking-[0.2em] border-b-2 border-slate-100 pb-1">Voir plus d'applications</Link>
                    </div>
                </div>
            </main>

            {/* Footer style taap.it */}
            <footer className="py-16 border-t border-slate-50 text-center">
                <div className="max-w-5xl mx-auto flex flex-col items-center gap-10">
                    <div className="flex flex-wrap justify-center gap-10 text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">
                        <Link href="/privacy" className="hover:text-slate-900 transition-colors">Confidentialité</Link>
                        <Link href="/terms" className="hover:text-slate-900 transition-colors">Conditions</Link>
                        <Link href="#" className="hover:text-slate-900 transition-colors">Contact</Link>
                    </div>
                    <p className="text-[10px] font-black text-slate-200 uppercase tracking-[0.4em]">© 2026 Cal Afrik</p>
                </div>
            </footer>
        </div>
    )
}
