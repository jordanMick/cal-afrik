'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Sparkles, CheckCircle2, ChevronRight, AlertCircle, Upload, Clock, Star, Image as ImageIcon } from 'lucide-react'
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

    // Inline Styles for bulletproof layout
    const navStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '80px' }
    const heroStyle = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const, maxWidth: '800px', margin: '0 auto', padding: '160px 24px 80px' }
    const scanButtonStyle = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', background: '#111', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', padding: '40px', width: '100%', maxWidth: '400px', margin: '0 auto 60px', cursor: 'pointer', transition: 'all 0.2s' }
    const featureGridStyle = { display: 'flex', justifyContent: 'center', gap: '60px', width: '100%', maxWidth: '600px', margin: '60px auto 0' }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-dm-sans), sans-serif', overflowX: 'hidden' }}>
            {/* Header */}
            <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={navStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#10b981', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                            CA
                        </div>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.5px', fontFamily: 'var(--font-syne), sans-serif' }}>Cal Afrik</span>
                    </div>
                    <Link href="/login" style={{ padding: '10px 24px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: '#fff', textDecoration: 'none' }}>
                        Ouvrir Cal Afrik
                    </Link>
                </div>
            </nav>

            <main style={heroStyle}>
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

                {/* New Action Area (Not an input) */}
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
                                
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginBottom: '40px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '64px', fontWeight: 'bold' }}>{analysisResult.total_summary.calories}</div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>Calories</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '32px', flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '32px' }}>
                                        <div>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{analysisResult.total_summary.proteins}g</div>
                                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Prot.</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{analysisResult.total_summary.carbs}g</div>
                                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Gluc.</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{analysisResult.total_summary.lipids}g</div>
                                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Lip.</div>
                                        </div>
                                    </div>
                                </div>

                                <Link href="/login?mode=register" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', background: '#fff', color: '#000', borderRadius: '12px', fontWeight: 'bold', textDecoration: 'none', fontSize: '18px' }}>
                                    S'inscrire pour voir l'analyse <ChevronRight size={20} />
                                </Link>
                                
                                <button onClick={() => setAnalysisResult(null)} style={{ marginTop: '24px', width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer' }}>
                                    Scanner un autre plat
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error state */}
                    {error && (
                        <div style={{ background: '#1a1a1a', padding: '40px', borderRadius: '32px', border: '1px solid rgba(239,68,68,0.2)', maxWidth: '400px', margin: '0 auto 60px' }}>
                            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '20px' }} />
                            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>{error}</p>
                            <button onClick={() => setError(null)} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Réessayer</button>
                        </div>
                    )}
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
            <footer style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
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
