'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { calculateCalorieTarget } from '@/lib/nutrition'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

// ─── CONFIGURATION DES ÉTAPES ──────────────────────────────────────

const COUNTRIES = [
    { code: 'TG', name: '🇹🇬 Togo' },
    { code: 'CI', name: '🇨🇮 Côte d\'Ivoire' },
    { code: 'SN', name: '🇸🇳 Sénégal' },
    { code: 'BJ', name: '🇧🇯 Bénin' },
    { code: 'GH', name: '🇬🇭 Ghana' },
    { code: 'ML', name: '🇲🇱 Mali' },
    { code: 'CM', name: '🇨🇲 Cameroun' },
    { code: 'Other', name: '🌍 Autre/International' },
]

const EATING_HABITS = [
    { id: 'grignotage', label: '🍿 Grignotage', icon: '🍪' },
    { id: 'sucre', label: '🍭 Addict au sucre', icon: '🥤' },
    { id: 'heavy', label: '🥘 Plats lourds le soir', icon: '🌙' },
    { id: 'fastfood', label: '🍔 Fast food fréquent', icon: '🍟' },
    { id: 'skip_breakfast', label: '☕ Saute le petit déj', icon: '☀️' },
    { id: 'stress_eating', label: '🤯 Mange sous stress', icon: '💥' },
]

const CUISINES = ['Africaine (Générale)', 'Togolaise', 'Ivoirienne', 'Sénégalaise', 'Nigériane', 'Camerounaise', 'Internationale']

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter()
    const { profile, setProfile } = useAppStore()
    const [step, setStep] = useState(0)
    const [isSaving, setIsSaving] = useState(false)
    const [analysisProgress, setAnalysisProgress] = useState(0)

    const [form, setForm] = useState({
        name: profile?.name || '',
        goal: (profile?.goal as UserProfile['goal']) || 'maintenir',
        weight_kg: profile?.weight_kg?.toString() || '',
        target_weight_kg: profile?.goal_weight_kg?.toString() || '',
        height_cm: profile?.height_cm?.toString() || '',
        age: profile?.age?.toString() || '',
        gender: (profile?.gender as 'homme' | 'femme') || 'homme',
        activity_level: (profile?.activity_level as UserProfile['activity_level']) || 'modere',
        eating_habits: [] as string[],
        preferred_cuisines: profile?.preferred_cuisines || [] as string[],
        target_weeks: '8', // valeur par défaut pour la projection
        country: profile?.country || 'TG',
    })

    // ─── ACTIONS ──────────────────────────────────────────────────

    const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

    const toggleHabit = (id: string) => {
        setForm(prev => ({
            ...prev,
            eating_habits: prev.eating_habits.includes(id)
                ? prev.eating_habits.filter(h => h !== id)
                : [...prev.eating_habits, id]
        }))
    }

    const next = () => setStep(s => s + 1)
    const back = () => setStep(s => s - 1)

    // Gestion de l'animation d'analyse (Step 9)
    useEffect(() => {
        if (step === 9) {
            setAnalysisProgress(0)
            const interval = setInterval(() => {
                setAnalysisProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval)
                        setTimeout(next, 800)
                        return 100
                    }
                    return prev + 2
                })
            }, 50)
            return () => clearInterval(interval)
        }
    }, [step])

    const handleFinish = async () => {
        setIsSaving(true)
        try {
            const targets = calculateCalorieTarget({
                age: Number(form.age),
                gender: form.gender,
                weight_kg: Number(form.weight_kg),
                height_cm: Number(form.height_cm),
                activity_level: form.activity_level,
                goal: form.goal,
            })

            const profileData = {
                name: form.name,
                age: Number(form.age),
                gender: form.gender,
                weight_kg: Number(form.weight_kg),
                height_cm: Number(form.height_cm),
                activity_level: form.activity_level,
                goal: form.goal,
                goal_weight_kg: Number(form.target_weight_kg) || null,
                country: form.country,
                preferred_cuisines: form.preferred_cuisines,
                subscription_tier: 'free',
                ...targets,
            }

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: updated, error } = await supabase
                .from('user_profiles')
                .upsert({ user_id: session.user.id, ...profileData })
                .select().single()

            if (error) throw error
            setProfile(updated)
            router.push('/dashboard')
        } catch (err) {
            console.error(err)
            alert('Erreur lors de la sauvegarde')
        } finally {
            setIsSaving(false)
        }
    }

    // Calcul des macros en temps réel pour l'affichage final
    const liveResults = calculateCalorieTarget({
        age: Number(form.age) || 25,
        gender: form.gender,
        weight_kg: Number(form.weight_kg) || 70,
        height_cm: Number(form.height_cm) || 170,
        activity_level: form.activity_level,
        goal: form.goal,
    })

    return (
        <div style={{
            minHeight: '100vh', background: '#000', color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 24px 100px',
            maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            `}</style>

            {/* PROGRESS BAR */}
            {step < 9 && (
                <div style={{ width: '100%', height: '4px', background: '#111', borderRadius: '2px', marginBottom: '40px' }}>
                    <div style={{ 
                        width: `${(step / 9) * 100}%`, height: '100%', 
                        background: 'linear-gradient(90deg, #22c55e, #10b981)', 
                        borderRadius: '2px', transition: 'width 0.4s ease' 
                    }} />
                </div>
            )}

            {/* 0. NOM */}
            {step === 0 && (
                <StepWrapper key="step0" title="Commençons par faire connaissance" sub="Comment devons-nous vous appeler ?" icon="👋">
                    <input 
                        autoFocus
                        type="text" value={form.name} onChange={e => update('name', e.target.value)}
                        placeholder="Votre prénom"
                        style={{ width: '100%', height: '60px', background: '#111', border: '1.5px solid #222', borderRadius: '16px', color: '#fff', padding: '0 20px', fontSize: '18px', outline: 'none' }}
                    />
                    <div style={{ marginTop: '40px' }}>
                        <NextButton disabled={!form.name} onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 1. OBJECTIF */}
            {step === 1 && (
                <StepWrapper key="step1" title="Quel est votre objectif ?" icon="🎯">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { id: 'perdre', label: 'Perdre du poids', icon: '🔥' },
                            { id: 'maintenir', label: 'Maintenir mon poids', icon: '⚖️' },
                            { id: 'prendre', label: 'Prendre du muscle', icon: '💪' },
                        ].map(g => (
                            <button key={g.id} onClick={() => { update('goal', g.id); next(); }} style={{
                                padding: '24px', background: form.goal === g.id ? 'rgba(34,197,94,0.1)' : '#111',
                                border: form.goal === g.id ? '1px solid #22c55e' : '1.5px solid #222',
                                borderRadius: '16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '15px'
                            }}>
                                <span style={{ fontSize: '24px' }}>{g.icon}</span>
                                <span style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{g.label}</span>
                            </button>
                        ))}
                    </div>
                </StepWrapper>
            )}

            {/* 2, 3, 4. MEASUREMENTS */}
            {step === 2 && (
                <StepWrapper key="step2" title="Dites-nous votre poids actuel" icon="⚖️">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="number" autoFocus value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', fontSize: '64px', fontWeight: '800', outline: 'none' }} />
                        <span style={{ fontSize: '24px', color: '#666' }}>kg</span>
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton disabled={!form.weight_kg} onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {step === 3 && (
                <StepWrapper key="step3" title="Quelle est votre taille ?" icon="📏">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="number" autoFocus value={form.height_cm} onChange={e => update('height_cm', e.target.value)} style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', fontSize: '64px', fontWeight: '800', outline: 'none' }} />
                        <span style={{ fontSize: '24px', color: '#666' }}>cm</span>
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton disabled={!form.height_cm} onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {step === 4 && (
                <StepWrapper key="step4" title="Quel est votre âge ?" icon="🎂">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="number" autoFocus value={form.age} onChange={e => update('age', e.target.value)} style={{ flex: 1, textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', fontSize: '64px', fontWeight: '800', outline: 'none' }} />
                        <span style={{ fontSize: '24px', color: '#666' }}>ans</span>
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton disabled={!form.age} onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 5. ACTIVITÉ */}
            {step === 5 && (
                <StepWrapper key="step5" title="Votre niveau d'activité ?" icon="⚡">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                            { id: 'sedentaire', label: 'Sédentaire', sub: 'Bureau, peu de sport' },
                            { id: 'leger', label: 'Légèrement actif', sub: '1-2 fois / semaine' },
                            { id: 'modere', label: 'Modéré', sub: '3-5 fois / semaine' },
                            { id: 'actif', label: 'Très actif', sub: '6+ fois / semaine' },
                        ].map(a => (
                            <button key={a.id} onClick={() => { update('activity_level', a.id); next(); }} style={{
                                padding: '18px', background: form.activity_level === a.id ? 'rgba(34,197,94,0.1)' : '#111',
                                border: form.activity_level === a.id ? '1px solid #22c55e' : '1.5px solid #222',
                                borderRadius: '14px', textAlign: 'left'
                            }}>
                                <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600' }}>{a.label}</div>
                                <div style={{ color: '#666', fontSize: '13px' }}>{a.sub}</div>
                            </button>
                        ))}
                    </div>
                </StepWrapper>
            )}

            {/* 6. HABITUDES */}
            {step === 6 && (
                <StepWrapper key="step6" title="Vos habitudes ?" sub="Identifiez ce qui vous freine aujourd'hui" icon="🍽️">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {EATING_HABITS.map(h => (
                            <button key={h.id} onClick={() => toggleHabit(h.id)} style={{
                                padding: '12px 20px', borderRadius: '30px', border: '1.5px solid #222',
                                background: form.eating_habits.includes(h.id) ? '#fff' : 'transparent',
                                color: form.eating_habits.includes(h.id) ? '#000' : '#888',
                                fontSize: '14px', fontWeight: '600', transition: 'all 0.2s'
                            }}>
                                {h.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 7. PRÉFÉRENCES (AFRIQUE / INTERNATIONAL) */}
            {step === 7 && (
                <StepWrapper key="step7" title="Vos préférences culinaires" sub="Pour adapter les calories aux plats que vous mangez réellement" icon="🌍">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {CUISINES.map(c => (
                            <button key={c} onClick={() => {
                                const list = form.preferred_cuisines.includes(c) ? form.preferred_cuisines.filter(x => x !== c) : [...form.preferred_cuisines, c]
                                update('preferred_cuisines', list)
                            }} style={{
                                padding: '15px', borderRadius: '12px', border: '1.5px solid #222',
                                background: form.preferred_cuisines.includes(c) ? 'rgba(34,197,94,0.1)' : '#111',
                                color: form.preferred_cuisines.includes(c) ? '#22c55e' : '#fff',
                                fontSize: '14px', textAlign: 'center'
                            }}>{c}</button>
                        ))}
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 8. PROJECTION */}
            {step === 8 && (
                <StepWrapper key="step8" title="Votre vision" sub="Dans quel délai voulez-vous atteindre cet objectif ?" icon="🎯">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {form.goal !== 'maintenir' && (
                            <div>
                                <label style={{ color: '#666', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Poids cible (kg)</label>
                                <input type="number" value={form.target_weight_kg} onChange={e => update('target_weight_kg', e.target.value)} style={{ width: '100%', height: '54px', background: '#111', border: '1.5px solid #222', borderRadius: '14px', color: '#fff', padding: '0 16px', fontSize: '18px', outline: 'none' }} />
                            </div>
                        )}
                        <div>
                            <label style={{ color: '#666', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Durée prévue (semaines)</label>
                            <input type="number" value={form.target_weeks} onChange={e => update('target_weeks', e.target.value)} style={{ width: '100%', height: '54px', background: '#111', border: '1.5px solid #222', borderRadius: '14px', color: '#fff', padding: '0 16px', fontSize: '18px', outline: 'none' }} />
                        </div>
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 9. ANALYSE (LA FAKE LOADING) */}
            {step === 9 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', position: 'relative', marginBottom: '30px' }}>
                        <svg width="100" height="100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#222" strokeWidth="8" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#22c55e" strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * analysisProgress) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '18px', fontWeight: '800' }}>{analysisProgress}%</div>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Calcul de votre plan...</h3>
                    <div style={{ color: '#666', minHeight: '20px' }}>
                        {analysisProgress < 30 && "Analyse du métabolisme basal..."}
                        {analysisProgress >= 30 && analysisProgress < 60 && "Optimisation des macros..."}
                        {analysisProgress >= 60 && analysisProgress < 90 && "Adaptation locale..."}
                        {analysisProgress >= 90 && "Plan prêt !"}
                    </div>
                </div>
            )}

            {/* 10. RESULTATS WOW */}
            {step === 10 && (
                <StepWrapper key="step10" title="C'est prêt !" sub={`Voici votre stratégie nutritionnelle personnalisée, ${form.name}.`} icon="🌟">
                    <div style={{ background: 'linear-gradient(135deg, #111, #080808)', border: '1.5px solid #222', borderRadius: '24px', padding: '30px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Cible quotidienne</div>
                        <div style={{ fontSize: '64px', fontWeight: '900', color: '#fff' }}>{liveResults.calorie_target}</div>
                        <div style={{ fontSize: '16px', color: '#666', marginBottom: '30px' }}>Calories / jour</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                            <div>
                                <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>{liveResults.protein_target_g}g</div>
                                <div style={{ color: '#666', fontSize: '11px' }}>Protéines</div>
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>{liveResults.carbs_target_g}g</div>
                                <div style={{ color: '#666', fontSize: '11px' }}>Glucides</div>
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>{liveResults.fat_target_g}g</div>
                                <div style={{ color: '#666', fontSize: '11px' }}>Lipides</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton label="Accéder à mon plan →" onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 11. PAYWALL */}
            {step === 11 && (
                <StepWrapper key="step11" title="Libérez tout votre potentiel" icon="🚀">
                    <div style={{ padding: '20px', background: '#111', borderRadius: '16px', border: '1px solid #333', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <span style={{ fontWeight: '700' }}>Premium</span>
                            <span style={{ color: '#22c55e' }}>Tout illimité</span>
                        </div>
                        <ul style={{ color: '#888', fontSize: '14px', listStyle: 'none', padding: 0 }}>
                            <li style={{ marginBottom: '8px' }}>✓ Coach Yao AI Illimité</li>
                            <li style={{ marginBottom: '8px' }}>✓ Scans photos illimités</li>
                            <li style={{ marginBottom: '8px' }}>✓ Statistiques & Graphiques</li>
                            <li>✓ Accès prioritaire 24/7</li>
                        </ul>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button 
                            disabled={isSaving}
                            onClick={() => router.push('/upgrade?hideFree=true')}
                            style={{ width: '100%', height: '54px', background: 'linear-gradient(90deg, #22c55e, #10b981)', color: '#000', borderRadius: '14px', fontWeight: '800', border: 'none', cursor: 'pointer' }}>
                            Voir les offres Premium
                        </button>
                        <button 
                            disabled={isSaving}
                            onClick={handleFinish}
                            style={{ width: '100%', height: '54px', background: 'transparent', color: '#666', borderRadius: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
                            Continuer gratuitement (limité)
                        </button>
                    </div>
                </StepWrapper>
            )}

            {/* BTN RETOUR */}
            {step > 0 && step < 9 && (
                <button onClick={back} style={{ position: 'fixed', bottom: '40px', left: '24px', background: 'transparent', border: 'none', color: '#444', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>← Précédent</button>
            )}
        </div>
    )
}

// ─── COMPOSANTS AUXILIAIRES (HORS DU RENDU PRINCIPAL) ───

function StepWrapper({ children, title, sub, icon }: { children: React.ReactNode, title: string, sub?: string, icon?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', animation: 'fadeIn 0.4s ease' }}>
            <div style={{ textAlign: 'center' }}>
                {icon && <div style={{ fontSize: '48px', marginBottom: '20px' }}>{icon}</div>}
                <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '10px', letterSpacing: '-0.5px' }}>{title}</h2>
                {sub && <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.5' }}>{sub}</p>}
            </div>
            <div style={{ flex: 1 }}>{children}</div>
        </div>
    )
}

function NextButton({ disabled = false, label = "Continuer", onClick }: { disabled?: boolean, label?: string, onClick: () => void }) {
    return (
        <button 
            disabled={disabled}
            onClick={onClick}
            style={{
                width: '100%', height: '54px', background: disabled ? '#1a1a1a' : '#fff',
                color: disabled ? '#444' : '#000', borderRadius: '16px',
                fontSize: '16px', fontWeight: '700', cursor: disabled ? 'default' : 'pointer',
                border: 'none', transition: 'all 0.2s',
                marginTop: 'auto'
            }}
        >
            {label}
        </button>
    )
}