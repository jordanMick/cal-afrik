'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Image as ImageIcon, Sparkles, CheckCircle2, ChevronRight, Info, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LandingPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [analysisStep, setAnalysisStep] = useState(0)

    const analysisSteps = [
        "Identification du plat...",
        "Calcul des portions...",
        "Analyse nutritionnelle...",
        "Finalisation Yao..."
    ]

    useEffect(() => {
        let interval: any
        if (isAnalyzing) {
            setProgress(0)
            setAnalysisStep(0)
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) return 100
                    return prev + 1
                })
            }, 50)

            const stepInterval = setInterval(() => {
                setAnalysisStep(prev => (prev < analysisSteps.length - 1 ? prev + 1 : prev))
            }, 1200)

            return () => {
                clearInterval(interval)
                clearInterval(stepInterval)
            }
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
                    image: {
                        data: base64,
                        mimeType: file.type
                    }
                })
            })

            const data = await res.json()
            
            // Simuler un peu de temps pour l'animation
            setTimeout(() => {
                if (data.success) {
                    if (data.items.length === 0) {
                        setError("Yao n'a pas reconnu de nourriture sur cette photo. Assurez-vous que le plat est bien visible.")
                    } else {
                        setAnalysisResult(data)
                    }
                } else {
                    setError("Une erreur est survenue lors de l'analyse. Réessayez avec une autre photo.")
                }
                setIsAnalyzing(false)
            }, 3000)

        } catch (err) {
            console.error(err)
            setError("Erreur de connexion. Vérifiez votre réseau.")
            setIsAnalyzing(false)
        }
    }

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result!.toString().split(',')[1])
        reader.onerror = reject
    })

    const triggerFileSelect = () => {
        fileInputRef.current?.click()
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-[var(--branding)] selection:text-white">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[var(--branding)] rounded-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight syne-font">Cal Afrik</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="/login" className="text-sm font-medium hover:text-[var(--branding)] transition-colors">
                            Connexion
                        </Link>
                        <Link href="/login?mode=register" className="px-4 py-2 bg-[var(--branding)] text-white rounded-full text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-emerald-900/20">
                            S'inscrire
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter syne-font mb-6 leading-[1.1]">
                        Mangez mieux, <br />
                        <span className="text-[var(--branding)]">Simplement.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-12">
                        L'intelligence artificielle spécialisée dans la nutrition africaine. 
                        Scannez vos plats, suivez vos calories et atteignez vos objectifs santé sans effort.
                    </p>

                    <div className="relative max-w-md mx-auto group">
                        {/* Interactive Area */}
                        {!isAnalyzing && !analysisResult && !error && (
                            <div 
                                onClick={triggerFileSelect}
                                className="glass-panel rounded-3xl p-8 border-dashed border-2 border-[var(--border-color)] group-hover:border-[var(--branding)] transition-all cursor-pointer bg-gradient-to-b from-white/5 to-transparent"
                            >
                                <div className="w-16 h-16 bg-[var(--branding)]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <Camera className="w-8 h-8 text-[var(--branding)]" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Tester gratuitement</h3>
                                <p className="text-sm text-[var(--text-secondary)] mb-6">
                                    Prenez une photo de votre plat ou choisissez une image.
                                </p>
                                <div className="px-6 py-3 bg-[var(--branding)] text-white rounded-xl font-bold inline-flex items-center gap-2 hover:shadow-xl hover:shadow-emerald-900/40 transition-all active:scale-95">
                                    Scanner mon plat
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        )}

                        {/* Loading State */}
                        <AnimatePresence>
                            {isAnalyzing && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass-panel rounded-3xl p-8 border-[var(--branding)] border"
                                >
                                    <div className="w-20 h-20 mx-auto mb-6 relative">
                                        <div className="absolute inset-0 border-4 border-[var(--branding)]/10 rounded-full"></div>
                                        <motion.div 
                                            className="absolute inset-0 border-4 border-[var(--branding)] border-t-transparent rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center font-bold text-[var(--branding)]">
                                            {progress}%
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Analyse par Yao...</h3>
                                    <p className="text-sm text-[var(--branding)] font-medium animate-pulse">
                                        {analysisSteps[analysisStep]}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Result State */}
                        <AnimatePresence>
                            {analysisResult && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="glass-panel rounded-3xl p-8 border-[var(--success)] border bg-emerald-500/5"
                                >
                                    <div className="flex items-center justify-center gap-2 text-[var(--success)] mb-6 font-bold">
                                        <CheckCircle2 className="w-6 h-6" />
                                        Analyse Terminée !
                                    </div>
                                    
                                    <div className="text-center mb-8">
                                        <div className="text-4xl font-bold mb-1">{analysisResult.total_summary.calories}</div>
                                        <div className="text-sm text-[var(--text-secondary)] uppercase tracking-wider font-bold">Calories Estimées</div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mb-8">
                                        <div className="p-3 bg-white/5 rounded-xl">
                                            <div className="text-sm font-bold">{analysisResult.total_summary.proteins}g</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase">Protéines</div>
                                        </div>
                                        <div className="p-3 bg-white/5 rounded-xl">
                                            <div className="text-sm font-bold">{analysisResult.total_summary.carbs}g</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase">Glucides</div>
                                        </div>
                                        <div className="p-3 bg-white/5 rounded-xl">
                                            <div className="text-sm font-bold">{analysisResult.total_summary.lipids}g</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase">Lipides</div>
                                        </div>
                                    </div>

                                    <div className="bg-[var(--branding)]/10 border border-[var(--branding)]/20 rounded-2xl p-4 mb-6">
                                        <p className="text-sm font-medium leading-relaxed">
                                            <Sparkles className="w-4 h-4 inline mr-2 text-[var(--branding)]" />
                                            Ceci est un aperçu. Pour voir la décomposition complète de votre plat et profiter de <strong>5 scans gratuits</strong>, inscrivez-vous maintenant !
                                        </p>
                                    </div>

                                    <Link href="/login?mode=register" className="w-full py-4 bg-[var(--branding)] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-emerald-900/30">
                                        Récupérer mes 5 scans gratuits
                                        <ChevronRight className="w-5 h-5" />
                                    </Link>
                                    
                                    <button 
                                        onClick={() => setAnalysisResult(null)}
                                        className="mt-4 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium"
                                    >
                                        Recommencer l'essai
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error State */}
                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="glass-panel rounded-3xl p-8 border-[var(--danger)] border bg-red-500/5"
                                >
                                    <AlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
                                    <h3 className="text-xl font-bold mb-2">Mince !</h3>
                                    <p className="text-sm text-[var(--text-secondary)] mb-8">
                                        {error}
                                    </p>
                                    <button 
                                        onClick={triggerFileSelect}
                                        className="w-full py-4 bg-[var(--bg-tertiary)] rounded-xl font-bold hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-2"
                                    >
                                        Réessayer avec une autre photo
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Hidden File Input */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            accept="image/*" 
                            capture="environment"
                            className="hidden" 
                        />
                    </div>
                </motion.div>

                {/* Platform Icons (Inspired by taap.it) */}
                <div className="mt-20 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-widest">Vision IA</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-widest">Base de données Locale</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-widest">Coach Yao</span>
                    </div>
                </div>
            </main>

            {/* Why Cal Afrik? */}
            <section className="py-20 px-6 bg-[var(--bg-secondary)]/50">
                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-12 text-left">
                    <div>
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                            <Camera className="w-6 h-6 text-blue-500" />
                        </div>
                        <h4 className="text-xl font-bold mb-4 syne-font">Précision Africaine</h4>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            Fini les erreurs sur le Fufu, l'Attiéké ou le Riz Gras. Yao connaît vos plats par cœur.
                        </p>
                    </div>
                    <div>
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                            <Sparkles className="w-6 h-6 text-amber-500" />
                        </div>
                        <h4 className="text-xl font-bold mb-4 syne-font">Coach Nutritionnel</h4>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            Recevez des conseils personnalisés pour équilibrer vos repas sans changer vos habitudes.
                        </p>
                    </div>
                    <div>
                        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-6 h-6 text-purple-500" />
                        </div>
                        <h4 className="text-xl font-bold mb-4 syne-font">Objectifs Atteints</h4>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                            Perte de poids ou prise de masse, suivez votre progression avec une clarté totale.
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-[var(--border-color)] text-center">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-sm text-[var(--text-muted)]">
                        © 2026 Cal Afrik. Tous droits réservés.
                    </p>
                    <div className="flex gap-8 text-sm text-[var(--text-muted)] font-medium">
                        <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Confidentialité</Link>
                        <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Conditions</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
