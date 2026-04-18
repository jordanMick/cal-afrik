'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, FileText, Download, Calendar, TrendingUp, Info, Crown, Award, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'
import { supabase } from '@/lib/supabase'

export default function ReportsPage() {
    const router = useRouter()
    const { profile } = useAppStore()
    const [isLoading, setIsLoading] = useState(true)
    const [monthsData, setMonthsData] = useState<any>(null)
    const [coachAnalysis, setCoachAnalysis] = useState<string>('')
    const [isGenerating, setIsGenerating] = useState(false)

    const effectiveTier = getEffectiveTier(profile)
    const isPremium = effectiveTier === 'premium' || effectiveTier === 'pro'

    useEffect(() => {
        if (isPremium) {
            fetchMonthlyData()
        } else {
            setIsLoading(false)
        }
    }, [isPremium])

    const fetchMonthlyData = async () => {
        setIsLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // 1. Récupérer les 30 derniers jours
            const dateTo = new Date().toISOString().split('T')[0]
            const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            const tzOffset = new Date().getTimezoneOffset()

            const res = await fetch(`/api/meals?date_from=${dateFrom}&date_to=${dateTo}&tz_offset_min=${tzOffset}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()

            if (json.success) {
                const meals = json.data || []
                processStats(meals)
            }
        } catch (err) {
            console.error('Fetch monthly data error:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const processStats = (meals: any[]) => {
        const totalCals = meals.reduce((sum, m) => sum + m.calories, 0)
        const totalProt = meals.reduce((sum, m) => sum + m.protein_g, 0)
        const totalCarbs = meals.reduce((sum, m) => sum + m.carbs_g, 0)
        const totalFat = meals.reduce((sum, m) => sum + m.fat_g, 0)
        
        // Jours uniques avec au moins un repas
        const uniqueDays = new Set(meals.map(m => m.logged_at.split('T')[0])).size
        const avgCals = uniqueDays > 0 ? totalCals / uniqueDays : 0
        const avgProt = uniqueDays > 0 ? totalProt / uniqueDays : 0
        const avgCarbs = uniqueDays > 0 ? totalCarbs / uniqueDays : 0
        const avgFat = uniqueDays > 0 ? totalFat / uniqueDays : 0

        setMonthsData({
            totalMeals: meals.length,
            activeDays: uniqueDays,
            avgCals,
            avgProt,
            avgCarbs,
            avgFat,
            meals // Keep for analysis
        })

        // Lancer l'analyse Coach Yao
        generateCoachAnalysis({
            avgCals,
            avgProt,
            avgCarbs,
            avgFat,
            meals: meals.slice(0, 5) // Send top 5 recent meals for context
        })
    }

    const generateCoachAnalysis = async (stats: any) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/bilan', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    type: 'mensuel',
                    dailyCalories: stats.avgCals,
                    dailyProtein: stats.avgProt,
                    dailyCarbs: stats.avgCarbs,
                    dailyFat: stats.avgFat,
                    calorieTarget: profile?.calorie_target || 2000,
                    proteinTarget: profile?.protein_target_g || 150,
                    carbsTarget: profile?.carbs_target_g || 250,
                    fatTarget: profile?.fat_target_g || 65,
                    goal: profile?.goal || 'maintenir',
                    meals: stats.meals
                })
            })
            const json = await res.json()
            if (json.success) {
                setCoachAnalysis(json.message)
            } else {
                setCoachAnalysis(json.message || "Impossible de générer le bilan pour le moment.")
            }
        } catch (err) {
            console.error('Coach analysis error:', err)
            setCoachAnalysis("Erreur de connexion avec l'assistant. Veuillez réessayer plus tard.")
        }
    }

    const handleDownloadPDF = () => {
        setIsGenerating(true)
        // Simuler la préparation
        setTimeout(() => {
            window.print()
            setIsGenerating(false)
        }, 800)
    }

    if (!isPremium) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', maxWidth: '480px', margin: '0 auto', padding: '52px 20px' }}>
                <button onClick={() => router.back()} style={{ marginBottom: '24px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={24} />
                </button>
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '30px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Crown size={40} color="var(--accent)" />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>Bilan Santé Pro</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                        Accédez à une analyse mensuelle détaillée de votre nutrition et exportez-la en PDF pour votre médecin ou nutritionniste.
                    </p>
                    <button 
                        onClick={() => router.push('/settings/subscription')}
                        style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent), #10b981)', color: '#fff', border: 'none', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 10px 25px rgba(var(--accent-rgb), 0.3)' }}
                    >
                        Devenir Premium
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="report-container" style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', maxWidth: '480px', margin: '0 auto', paddingBottom: '120px' }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { margin: 15mm; }
                    .no-print { display: none !important; }
                    body { background: white !important; color: black !important; padding: 0 !important; }
                    .report-container { padding: 0 !important; max-width: none !important; width: 100% !important; margin: 0 !important; }
                    #pdf-report { padding: 0 !important; }
                    div { border-color: #eee !important; box-shadow: none !important; background-color: white !important; }
                    p, span, h1, h2, h3 { color: black !important; }
                }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            ` }} />
            
            {/* Header (Hidden on print) */}
            <div className="no-print" style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: '20px', fontWeight: '800' }}>Bilan Santé</h1>
                </div>
                <button 
                    onClick={handleDownloadPDF}
                    disabled={isLoading || isGenerating}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 14px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', opacity: (isLoading || isGenerating) ? 0.6 : 1 }}
                >
                    {isGenerating ? 'Préparation...' : <><Download size={16} /> PDF</>}
                </button>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>Compilation du mois...</p>
                </div>
            ) : (
                <div style={{ padding: '0 20px' }}>
                    
                    {/* Month Selector (Mock) */}
                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '14px', marginBottom: '24px', border: '0.5px solid var(--border-color)' }}>
                        <Calendar size={18} color="var(--text-muted)" />
                        <p style={{ fontSize: '14px', fontWeight: '600' }}>Période : 30 derniers jours</p>
                    </div>

                    {/* PDF CONTENT START */}
                    <div id="pdf-report" style={{ padding: '10px 0' }}>
                        
                        {/* Header PDF Pro */}
                        <div style={{ display: 'none', marginBottom: '32px' }} className="show-on-print">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--accent)', paddingBottom: '20px' }}>
                                <div>
                                    <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--accent)', margin: 0 }}>Cal-Afrik</h1>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>Bilan Santé Personnel</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{profile?.name || 'Utilisateur Cal-Afrik'}</p>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                                </div>
                            </div>
                        </div>

                        <style dangerouslySetInnerHTML={{ __html: `
                            @media print {
                                .show-on-print { display: block !important; }
                            }
                        ` }} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '20px', border: '0.5px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <TrendingUp size={14} color="#10b981" />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Considérés</span>
                                </div>
                                <p style={{ fontSize: '24px', fontWeight: '800' }}>{monthsData?.activeDays || 0}</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>jours d'activité</p>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '20px', border: '0.5px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Award size={14} color="#f59e0b" />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Record</span>
                                </div>
                                <p style={{ fontSize: '24px', fontWeight: '800' }}>{monthsData?.totalMeals || 0}</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>repas enregistrés</p>
                            </div>
                        </div>

                        {/* Calories Overview */}
                        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '24px', border: '0.5px solid var(--border-color)', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, right: 0, padding: '12px 16px', borderBottomLeftRadius: '16px', background: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent)', fontSize: '10px', fontWeight: '800' }}>MOYENNE</div>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '16px' }}>Apport calorique journalier</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '20px' }}>
                                <p style={{ fontSize: '42px', fontWeight: '800', letterSpacing: '-1px' }}>{Math.round(monthsData?.avgCals || 0)}</p>
                                <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-muted)' }}>kcal /jour</p>
                            </div>
                            {/* Progress Bar */}
                            <div style={{ height: '8px', width: '100%', background: 'var(--bg-primary)', borderRadius: '4px', position: 'relative', marginBottom: '12px' }}>
                                <div style={{ 
                                    height: '100%', 
                                    width: `${Math.min(100, ((monthsData?.avgCals || 0) / (profile?.calorie_target || 2000)) * 100)}%`, 
                                    background: 'var(--accent)', 
                                    borderRadius: '4px' 
                                }} />
                                <div style={{ position: 'absolute', top: -4, left: `${Math.min(100, ((profile?.calorie_target || 2000) / 3500) * 100)}%`, height: '16px', width: '2px', background: 'var(--text-muted)', opacity: 0.5 }} />
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Objectif : {profile?.calorie_target || 2000} kcal</p>
                        </div>

                        {/* Macros Chart */}
                        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '24px', border: '0.5px solid var(--border-color)', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px' }}>Équilibre des Macronutriments</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {[
                                    { label: 'Protéines', value: monthsData?.avgProt, target: profile?.protein_target_g || 150, color: '#10b981', unit: 'g' },
                                    { label: 'Glucides', value: monthsData?.avgCarbs, target: profile?.carbs_target_g || 250, color: 'var(--accent)', unit: 'g' },
                                    { label: 'Lipides', value: monthsData?.avgFat, target: profile?.fat_target_g || 65, color: '#f59e0b', unit: 'g' },
                                ].map(macro => (
                                    <div key={macro.label}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600' }}>{macro.label}</span>
                                            <span style={{ fontSize: '13px', fontWeight: '700' }}>{Math.round(macro.value || 0)}{macro.unit} <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '11px' }}>/ {macro.target}{macro.unit}</span></span>
                                        </div>
                                        <div style={{ height: '6px', width: '100%', background: 'var(--bg-primary)', borderRadius: '3px' }}>
                                            <div style={{ height: '100%', width: `${Math.min(100, ((macro.value || 0) / (macro.target || 1)) * 100)}%`, background: macro.color, borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Coach Yao Analysis */}
                        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '24px', border: `1px solid var(--accent)40`, marginBottom: '24px', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: -12, left: 24, padding: '4px 12px', background: 'var(--accent)', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Le Mot de Yao</div>
                            <div style={{ marginTop: '10px' }}>
                                {coachAnalysis ? (
                                    <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                                        "{coachAnalysis}"
                                    </p>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <div style={{ width: '20px', height: '20px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                                        <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Yao analyse votre mois...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer PDF Pro */}
                        <div style={{ display: 'none', marginTop: '40px', borderTop: '0.5px solid #eee', paddingTop: '20px', textAlign: 'center' }} className="show-on-print">
                            <p style={{ fontSize: '13px', color: '#444', fontWeight: '700' }}>Rapport généré par Cal-Afrik</p>
                            <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Document confidentiel destiné à l'usage personnel de l'utilisateur.</p>
                        </div>

                    </div>
                    {/* PDF CONTENT END */}

                    <div className="no-print" style={{ padding: '16px', background: 'rgba(var(--accent-rgb), 0.05)', borderRadius: '16px', border: '1px solid rgba(var(--accent-rgb), 0.1)', display: 'flex', gap: '12px' }}>
                        <Info size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            Besoin d'aide ? Vous pouvez partager ce rapport avec votre professionnel de santé. Utilisez le bouton "PDF" en haut pour générer une version imprimable.
                        </p>
                    </div>

                </div>
            )}
        </div>
    )
}
