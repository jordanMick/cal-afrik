'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Sparkles, CheckCircle2, ChevronRight, AlertCircle, Upload, Clock, Star, Image as ImageIcon } from 'lucide-react'
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
            // Plus besoin d'envoyer l'image réelle (trop lourde) car c'est une simulation
            const res = await fetch('/api/demo/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: true }) // On envoie juste un signal
            })
            const data = await res.json()
            
            setProgress(100)
            if (data.success) {
                setAnalysisResult(data)
            } else {
                setError(data.error || "L'analyse a échoué. Veuillez réessayer.")
            }
            setIsAnalyzing(false)
        } catch (err) {
            console.error("Scan Error:", err)
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

    // Inline Styles for bulletproof layout
    const navStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '80px' }
    const heroStyle = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const, maxWidth: '800px', margin: '0 auto', padding: '160px 24px 80px' }
    const scanButtonStyle = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', background: '#111', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px', width: '100%', maxWidth: '400px', margin: '0 auto 60px', cursor: 'pointer', transition: 'all 0.2s' }
    const featureGridStyle = { display: 'flex', justifyContent: 'center', gap: '60px', width: '100%', maxWidth: '600px', margin: '60px auto 0' }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-dm-sans), sans-serif', overflowX: 'hidden', position: 'relative' }}>
            
            {/* Halos d'ambiance comme sur login */}
            <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 10, repeat: Infinity }}
                style={{ position: 'fixed', top: '-10%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)', zIndex: 0 }}
            />
            <motion.div
                animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 8, repeat: Infinity }}
                style={{ position: 'fixed', bottom: '-10%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,95,70,0.15) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(80px)', zIndex: 0 }}
            />

            {/* Header */}
            <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={navStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LeafIcon size={18} />
                        <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px', color: '#10b981', margin: 0 }}>Cal Afrik</h2>
                    </div>
                    <Link href="/login" style={{ padding: '10px 24px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: '#fff', textDecoration: 'none' }}>
                        Ouvrir Cal Afrik
                    </Link>
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

                {/* New Action Area */}
                <div style={{ width: '100%', position: 'relative' }}>
                    {!isAnalyzing && !analysisResult && !error && (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            style={scanButtonStyle}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                        >
                            <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: '#10b981' }}>
                                <Camera size={32} />
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Scanner un plat</div>
                            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>Prenez une photo ou importez un fichier</div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isAnalyzing && (
                        <div style={{ background: '#1a1a1a', padding: '40px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '400px', margin: '0 auto 60px' }}>
                            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 24px' }}>
                                <svg style={{ transform: 'rotate(-90deg)', width: '80px', height: '80px' }}>
                                    <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
                                    <motion.circle cx="40" cy="40" r="36" stroke="#10b981" strokeWidth="4" fill="none" strokeDasharray="226" strokeDashoffset={226 - (226 * progress) / 100} />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#10b981' }}>{progress}%</div>
                            </div>
                            <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', letterSpacing: '2px' }}>Analyse Yao...</p>
                        </div>
                    )}

                    {/* Result State */}
                    <AnimatePresence>
                        {analysisResult && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{ background: '#1a1a1a', borderRadius: '32px', padding: '40px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', maxWidth: '600px', margin: '0 auto 60px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '32px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    <CheckCircle2 size={20} /> Résultat prêt
                                </div>
                                
                                <div style={{ marginBottom: '40px' }}>
                                    <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', fontFamily: 'var(--font-syne), sans-serif' }}>Analyse terminée !</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
                                        Votre plat a été identifié avec succès. Inscrivez-vous maintenant pour débloquer les détails nutritionnels (Calories, Macros) et profitez de <strong>5 scans gratuits</strong> offerts.
                                    </p>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', opacity: 0.3, filter: 'blur(4px)', pointerEvents: 'none' }}>
                                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', minWidth: '80px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>450</div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Kcal</div>
                                    </div>
                                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', minWidth: '80px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>25g</div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Prot.</div>
                                    </div>
                                </div>

                                <Link href="/login?mode=register" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '20px', background: '#10b981', color: '#fff', borderRadius: '16px', fontWeight: 'bold', textDecoration: 'none', fontSize: '18px', boxShadow: '0 10px 30px rgba(16,185,129,0.3)' }}>
                                    Voir mon résultat + 5 scans offerts <ChevronRight size={20} />
                                </Link>
                                
                                <button onClick={() => setAnalysisResult(null)} style={{ marginTop: '24px', width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer' }}>
                                    Scanner un autre plat
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Secondary CTA */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <Link href="/login?mode=register" style={{ padding: '14px 40px', background: '#10b981', borderRadius: '12px', color: '#fff', fontSize: '18px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 10px 30px rgba(16,185,129,0.2)' }}>
                        Obtenir mes 5 scans offerts
                    </Link>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px' }}>C'est gratuit et sans engagement</p>
                </div>

                {/* Features */}
                <div style={featureGridStyle}>
                    {[
                        { icon: <Clock size={24} />, label: 'Vision AI' },
                        { icon: <Upload size={24} />, label: 'Sync Coach' },
                        { icon: <Star size={24} />, label: 'Yao' }
                    ].map((f, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>
                                {f.icon}
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>{f.label}</span>
                        </div>
                    ))}
                </div>

                {/* Hidden input */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{ display: 'none' }} />
            </main>

            {/* Footer */}
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
