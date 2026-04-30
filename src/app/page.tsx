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
                setProgress(prev => {
                    if (prev >= 95) return 95 // Hold at 95 until data arrives
                    return prev + 5
                })
            }, 100)
            return () => clearInterval(interval)
        }
    }, [isAnalyzing])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsAnalyzing(true)
        setError(null)
        setAnalysisResult(null)

        try {
            const base64 = await toBase64(file)
            const res = await fetch('/api/demo/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: { data: base64, mimeType: file.type }
                })
            })

            const data = await res.json()
            
            // Simuler un temps de traitement pour l'expérience utilisateur
            setTimeout(() => {
                setProgress(100)
                if (data.success) {
                    if (data.items.length === 0) {
                        setError("Yao n'a pas reconnu de nourriture sur cette photo.")
                    } else {
                        setAnalysisResult(data)
                    }
                } else {
                    setError("Erreur d'analyse. Réessayez.")
                }
                setIsAnalyzing(false)
            }, 1500)

        } catch (err) {
            setError("Erreur réseau.")
            setIsAnalyzing(false)
        }
    }

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result!.toString().split(',')[1])
        reader.onerror = reject
    })

    return (
        <div className="min-h-screen bg-[#f9fafb] text-[#111827] font-sans overflow-x-hidden">
            {/* Header style taap.it */}
            <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#00d084] rounded-full flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-[#111827] syne-font">Cal Afrik</span>
                        </div>
                        <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-500">
                            <Link href="#" className="hover:text-black transition-colors">Produit</Link>
                            <Link href="#" className="hover:text-black transition-colors">Tarifs</Link>
                            <Link href="#" className="hover:text-black transition-colors">F.A.Q</Link>
                        </div>
                    </div>
                    <Link href="/login" className="px-5 py-2 bg-[#00d084] text-white rounded-lg text-sm font-bold hover:bg-[#00ba76] transition-all shadow-sm">
                        Ouvrir Cal Afrik
                    </Link>
                </div>
            </nav>

            <main className="pt-40 pb-20 px-6 max-w-4xl mx-auto text-center">
                {/* Hero section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#111827] mb-6 leading-tight syne-font">
                        Booster votre santé grâce au <br />
                        <span className="text-[#00d084]">scanner nutritionnel intelligent.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-500 mb-12 font-medium">
                        Analysez vos plats africains en une photo. Sans effort.
                    </p>

                    {/* Action Bar (Input style) */}
                    <div className="relative max-w-2xl mx-auto mb-8">
                        {!isAnalyzing && !analysisResult && !error && (
                            <div className="flex items-center p-1 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100">
                                <div className="flex-1 px-4 text-left text-gray-400 text-sm md:text-base font-medium truncate">
                                    Prenez une photo ou choisissez une image de votre plat...
                                </div>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-8 py-3 bg-[#00d084] text-white rounded-xl font-bold text-lg hover:bg-[#00ba76] transition-all active:scale-95"
                                >
                                    SCAN
                                </button>
                            </div>
                        )}

                        {/* Loading State */}
                        {isAnalyzing && (
                            <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-[#00d084]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="mt-4 text-sm font-bold text-[#00d084] animate-pulse uppercase tracking-widest">
                                    Analyse Yao en cours...
                                </p>
                            </div>
                        )}

                        {/* Result Modal-like state */}
                        <AnimatePresence>
                            {analysisResult && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-50 text-left"
                                >
                                    <div className="flex items-center gap-3 text-[#00d084] mb-6 font-bold">
                                        <CheckCircle2 className="w-6 h-6" />
                                        <span>Résultat prêt !</span>
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                                        <div className="text-center md:text-left flex-1">
                                            <div className="text-6xl font-black text-[#111827]">{analysisResult.total_summary.calories}</div>
                                            <div className="text-sm text-gray-400 font-bold uppercase tracking-widest">Calories</div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-6 flex-1 w-full">
                                            <div className="text-center">
                                                <div className="text-xl font-bold text-[#111827]">{analysisResult.total_summary.proteins}g</div>
                                                <div className="text-[10px] text-gray-400 uppercase font-bold">Prot.</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xl font-bold text-[#111827]">{analysisResult.total_summary.carbs}g</div>
                                                <div className="text-[10px] text-gray-400 uppercase font-bold">Gluc.</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xl font-bold text-[#111827]">{analysisResult.total_summary.lipids}g</div>
                                                <div className="text-[10px] text-gray-400 uppercase font-bold">Lip.</div>
                                            </div>
                                        </div>
                                    </div>

                                    <Link href="/login?mode=register" className="w-full py-4 bg-[#00d084] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#00ba76] transition-all shadow-lg shadow-[#00d084]/20">
                                        Voir l'analyse détaillée + 5 scans gratuits
                                        <ChevronRight className="w-5 h-5" />
                                    </Link>
                                    
                                    <button onClick={() => setAnalysisResult(null)} className="mt-6 w-full text-center text-sm text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase tracking-widest">
                                        Recommencer
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error state */}
                        {error && (
                            <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-50 border-t-4 border-t-red-500">
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Erreur d'analyse</h3>
                                <p className="text-gray-500 mb-6 font-medium">{error}</p>
                                <button onClick={() => setError(null)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-all">
                                    Réessayer
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Secondary CTA */}
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-10 py-4 bg-[#00d084] text-white rounded-2xl font-black text-xl hover:bg-[#00ba76] transition-all shadow-xl shadow-[#00d084]/20 hover:-translate-y-1"
                    >
                        Commencer gratuitement
                    </button>
                    <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Aucune carte bancaire requise</p>

                    {/* Hidden input */}
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                </motion.div>

                {/* Integration Icons style taap.it */}
                <div className="mt-20 flex flex-wrap justify-center items-center gap-10 opacity-30">
                    <div className="flex flex-col items-center gap-2">
                        <Camera className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Vision AI</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Upload className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Instant Sync</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Sparkles className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Coach Yao</span>
                    </div>
                </div>

                <div className="mt-8">
                    <Link href="#" className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest underline underline-offset-4">Voir plus d'applications</Link>
                </div>
            </main>

            {/* Footer style taap.it */}
            <footer className="mt-20 py-10 border-t border-gray-100 text-center">
                <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
                    <div className="flex gap-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <Link href="/privacy" className="hover:text-black transition-colors">Confidentialité</Link>
                        <Link href="/terms" className="hover:text-black transition-colors">Conditions</Link>
                        <Link href="#" className="hover:text-black transition-colors">Contact</Link>
                    </div>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">© 2026 Cal Afrik</p>
                </div>
            </footer>
        </div>
    )
}
