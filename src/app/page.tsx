'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Sparkles, CheckCircle2, ChevronRight, AlertCircle, Upload, Clock, Star, Image as ImageIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LeafIcon } from '@/components/icons/LeafIcon'

export default function LandingPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [analysisStep, setAnalysisStep] = useState(0)

    const steps = [
        "Numérisation du plat...",
        "Identification des ingrédients...",
        "Estimation des portions...",
        "Calcul des macros Yao...",
        "Finalisation du bilan..."
    ]

    useEffect(() => {
        let interval: any
        let timeoutId: any
        
        if (isAnalyzing) {
            setProgress(0)
            setAnalysisStep(0)
            
            // Progression de la barre (ralentit sur la fin)
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev < 30) return prev + 3
                    if (prev < 70) return prev + 1.5
                    if (prev < 95) return prev + 0.5
                    return prev >= 98 ? 98 : prev + 0.1
                })
            }, 100)

            // Progression séquentielle des messages avec délais variables (Total 10s)
            const stepDurations = [1000, 1500, 1500, 2000, 4000] 
            
            const runStep = (index: number) => {
                if (index < steps.length) {
                    setAnalysisStep(index)
                    timeoutId = setTimeout(() => runStep(index + 1), stepDurations[index])
                }
            }
            
            runStep(0)

            return () => {
                clearInterval(interval)
                clearTimeout(timeoutId)
            }
        }
    }, [isAnalyzing])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        
        setIsAnalyzing(true); setError(null); setAnalysisResult(null)
        try {
            const res = await fetch('/api/demo/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: true })
            })
            const data = await res.json()
            
            // On attend les 10 secondes prévues
            setTimeout(() => {
                setProgress(100)
                if (data.success) {
                    setAnalysisResult(data)
                } else {
                    setError(data.error || "L'analyse a échoué.")
                }
                setIsAnalyzing(false)
            }, 10000)
        } catch (err) {
            setError("Erreur de connexion.")
            setIsAnalyzing(false)
        }
    }

    // Styles
    const navStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '80px' }
    const heroStyle = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const, maxWidth: '800px', margin: '0 auto', padding: '160px 24px 80px' }
    const featureGridStyle = { display: 'flex', justifyContent: 'center', gap: '60px', width: '100%', maxWidth: '600px', margin: '60px auto 0' }
    const LOGIN_GRADIENT = 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-dm-sans), sans-serif', overflowX: 'hidden', position: 'relative' }}>
            
            {/* Image de fond (Preview) */}
            <AnimatePresence mode="wait">
                {previewUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isAnalyzing ? 0.4 : 0.2 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundImage: `url(${previewUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: isAnalyzing ? 'blur(10px)' : 'blur(40px)',
                            zIndex: 0
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Halos d'ambiance */}
            {!previewUrl && (
                <>
                    <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity }} style={{ position: 'fixed', top: '-10%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)', zIndex: 0 }} />
                    <motion.div animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 8, repeat: Infinity }} style={{ position: 'fixed', bottom: '-10%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,95,70,0.15) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)', zIndex: 0 }} />
                </>
            )}

            {/* Header */}
            <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={navStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LeafIcon size={18} />
                        <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#10b981', margin: 0 }}>Cal Afrik</h2>
                    </div>
                    <Link href="/login" style={{ padding: '10px 24px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: '#fff', textDecoration: 'none' }}>Connexion</Link>
                </div>
            </nav>

            <main style={{ ...heroStyle, position: 'relative', zIndex: 10 }}>
                {/* Badge Pill */}
                <div style={{ padding: '8px 24px', borderRadius: '100px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)', color: '#10b981', fontSize: '14px', fontWeight: 500, marginBottom: '48px' }}>
                    IA Yao — Analyse nutritionnelle africaine
                </div>

                <h1 style={{ fontSize: 'clamp(32px, 8vw, 64px)', fontWeight: 'bold', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '32px', fontFamily: 'var(--font-syne), sans-serif' }}>
                    Boostez votre santé grâce au <br />
                    <span style={{ color: 'rgba(16,185,129,0.8)' }}>scanner intelligent.</span>
                </h1>
                
                <p style={{ fontSize: 'clamp(16px, 4vw, 20px)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '64px', maxWidth: '600px' }}>
                    Identifiez vos plats africains et leurs calories instantanément.
                </p>

                <div style={{ width: '100%', position: 'relative' }}>
                    {!isAnalyzing && !analysisResult && !error && (
                        <>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                style={{ ...heroStyle, background: '#111', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', padding: '60px 40px', width: '100%', maxWidth: '400px', margin: '0 auto 40px', cursor: 'pointer' }}
                            >
                                <div style={{ width: '80px', height: '80px', background: 'rgba(16,185,129,0.1)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', color: '#10b981' }}>
                                    <Camera size={40} />
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Scanner un plat</div>
                                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>Prenez une photo ou importez un fichier</div>
                            </div>
                            <Link href="/login?mode=register" style={{ fontSize: '14px', fontWeight: 'bold', color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '60px' }}>S'inscrire directement <ChevronRight size={16} /></Link>
                        </>
                    )}

                    {/* Loading State with Steps */}
                    <AnimatePresence>
                        {isAnalyzing && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(10px)', padding: '48px', borderRadius: '32px', border: '1px solid rgba(16,185,129,0.2)', maxWidth: '450px', margin: '0 auto 60px', textAlign: 'center' }}>
                                <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 32px' }}>
                                    <svg style={{ transform: 'rotate(-90deg)', width: '100px', height: '100px' }}>
                                        <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none" />
                                        <motion.circle cx="50" cy="50" r="45" stroke="#10b981" strokeWidth="6" fill="none" strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100} />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900', color: '#10b981' }}>{Math.round(progress)}%</div>
                                </div>
                                <AnimatePresence mode="wait">
                                    <motion.div key={analysisStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                        <Loader2 size={16} className="animate-spin" color="#10b981" />
                                        <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>{steps[analysisStep]}</p>
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Result State */}
                    <AnimatePresence>
                        {analysisResult && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(30px)', borderRadius: '32px', padding: '48px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'left', maxWidth: '600px', margin: '0 auto 60px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '32px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}><CheckCircle2 size={20} /> Résultat prêt</div>
                                <div style={{ marginBottom: '40px' }}>
                                    <h3 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px', fontFamily: 'var(--font-syne), sans-serif' }}>Analyse terminée !</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', fontSize: '16px' }}>Votre plat a été identifié avec succès par l'IA Yao. Inscrivez-vous pour débloquer le bilan nutritionnel complet et profitez de <strong>5 scans gratuits</strong>.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '48px', opacity: 0.3, filter: 'blur(5px)', pointerEvents: 'none' }}>
                                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', flex: 1 }}><div style={{ fontSize: '28px', fontWeight: 'bold' }}>450</div><div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Kcal</div></div>
                                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', flex: 1 }}><div style={{ fontSize: '28px', fontWeight: 'bold' }}>25g</div><div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Prot.</div></div>
                                </div>
                                <Link href="/login?mode=register" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '20px', background: LOGIN_GRADIENT, color: '#fff', borderRadius: '20px', fontWeight: 'bold', textDecoration: 'none', fontSize: '18px', boxShadow: '0 10px 40px rgba(16,185,129,0.4)' }}>Voir mon résultat + 5 scans offerts <ChevronRight size={20} /></Link>
                                <button onClick={() => {setAnalysisResult(null); setPreviewUrl(null)}} style={{ marginTop: '32px', width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer' }}>Scanner un autre plat</button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div style={{ background: 'rgba(20,20,20,0.8)', padding: '48px', borderRadius: '32px', border: '1px solid rgba(239,68,68,0.3)', maxWidth: '450px', margin: '0 auto 60px' }}>
                            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '20px', margin: '0 auto 20px' }} />
                            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>{error}</p>
                            <button onClick={() => {setError(null); setPreviewUrl(null)}} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Réessayer</button>
                        </div>
                    )}
                </div>

                <div style={featureGridStyle}>
                    {[{ icon: <Clock size={24} />, label: 'Vision AI' }, { icon: <Upload size={24} />, label: 'Sync Coach' }, { icon: <Star size={24} />, label: 'Yao' }].map((f, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>{f.icon}</div>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>{f.label}</span>
                        </div>
                    ))}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{ display: 'none' }} />
            </main>

            <footer style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '24px' }}>
                    <Link href="/privacy" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Confidentialité</Link>
                    <Link href="/terms" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Conditions</Link>
                    <Link href="#" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Contact</Link>
                </div>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '3px' }}>© 2026 Cal Afrik</p>
            </footer>
        </div>
    )
}
