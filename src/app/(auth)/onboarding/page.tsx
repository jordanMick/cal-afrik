'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { calculateCalorieTarget } from '@/lib/nutrition'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

// ─── CONFIGURATION DES ÉTAPES ──────────────────────────────────────

const EATING_HABITS = [
    { id: 'grignotage', label: '🍿 Grignotage', icon: '🍪' },
    { id: 'sucre', label: '🍭 Addict au sucre', icon: '🥤' },
    { id: 'heavy', label: '🥘 Plats lourds le soir', icon: '🌙' },
    { id: 'fastfood', label: '🍔 Fast food fréquent', icon: '🍟' },
    { id: 'skip_breakfast', label: '☕ Saute le petit déj', icon: '☀️' },
    { id: 'stress_eating', label: '🤯 Mange sous stress', icon: '💥' },
]

const CUISINES = ['Africaine (Générale)', 'Togolaise', 'Ivoirienne', 'Sénégalaise', 'Nigériane', 'Camerounaise', 'Internationale']
const COUNTRIES = [
    { code: 'DZ', label: 'Algérie 🇩🇿' },
    { code: 'AO', label: 'Angola 🇦🇴' },
    { code: 'BJ', label: 'Bénin 🇧🇯' },
    { code: 'BW', label: 'Botswana 🇧🇼' },
    { code: 'BF', label: 'Burkina Faso 🇧🇫' },
    { code: 'BI', label: 'Burundi 🇧🇮' },
    { code: 'CV', label: 'Cabo Verde 🇨v' },
    { code: 'CM', label: 'Cameroun 🇨🇲' },
    { code: 'CF', label: 'Centrafrique 🇨f' },
    { code: 'TD', label: 'Tchad 🇹🇩' },
    { code: 'KM', label: 'Comores 🇰🇲' },
    { code: 'CD', label: 'Congo (RDC) 🇨🇩' },
    { code: 'CG', label: 'Congo (Brazzaville) 🇨🇬' },
    { code: 'CI', label: 'Côte d\'Ivoire 🇨🇮' },
    { code: 'DJ', label: 'Djibouti 🇩🇯' },
    { code: 'EG', label: 'Égypte 🇪🇬' },
    { code: 'ER', label: 'Érythrée 🇪🇷' },
    { code: 'SZ', label: 'Eswatini 🇸🇿' },
    { code: 'ET', label: 'Éthiopie 🇪🇹' },
    { code: 'GA', label: 'Gabon 🇬🇦' },
    { code: 'GM', label: 'Gambie 🇬🇲' },
    { code: 'GH', label: 'Ghana 🇬🇭' },
    { code: 'GN', label: 'Guinée 🇬🇳' },
    { code: 'GW', label: 'Guinée-Bissau 🇬🇼' },
    { code: 'GQ', label: 'Guinée équatoriale 🇬🇶' },
    { code: 'KE', label: 'Kenya 🇰🇪' },
    { code: 'LS', label: 'Lesotho 🇱s' },
    { code: 'LR', label: 'Liberia 🇱🇷' },
    { code: 'LY', label: 'Libye 🇱🇾' },
    { code: 'MG', label: 'Madagascar 🇲g' },
    { code: 'MW', label: 'Malawi 🇲w' },
    { code: 'ML', label: 'Mali 🇲🇱' },
    { code: 'MA', label: 'Maroc 🇲🇦' },
    { code: 'MU', label: 'Maurice 🇲u' },
    { code: 'MR', label: 'Mauritanie 🇲r' },
    { code: 'MZ', label: 'Mozambique 🇲z' },
    { code: 'NA', label: 'Namibie 🇳a' },
    { code: 'NE', label: 'Niger 🇳🇪' },
    { code: 'NG', label: 'Nigeria 🇳🇬' },
    { code: 'UG', label: 'Ouganda 🇺g' },
    { code: 'RW', label: 'Rwanda 🇷w' },
    { code: 'ST', label: 'Sao Tomé-et-Principe 🇸t' },
    { code: 'SN', label: 'Sénégal 🇸🇳' },
    { code: 'SC', label: 'Seychelles 🇸c' },
    { code: 'SL', label: 'Sierra Leone 🇸l' },
    { code: 'SO', label: 'Somalie 🇸o' },
    { code: 'SD', label: 'Soudan 🇸d' },
    { code: 'SS', label: 'Soudan du Sud 🇸s' },
    { code: 'ZA', label: 'Afrique du Sud 🇿🇦' },
    { code: 'TZ', label: 'Tanzanie 🇹z' },
    { code: 'TG', label: 'Togo 🇹🇬' },
    { code: 'TN', label: 'Tunisie 🇹🇳' },
    { code: 'ZM', label: 'Zambie 🇿m' },
    { code: 'ZW', label: 'Zimbabwe 🇿w' },
    { code: 'OTHER', label: 'Autre / Diaspora 🌍' },
]

// ─── COMPOSANTS AUXILIAIRES REUTILISABLES (PICKER WHEEL) ───────────

function WheelPicker({
    min, max, value, onChange, unit, step = 1
}: {
    min: number, max: number, value: number, onChange: (v: number) => void, unit?: string, step?: number
}) {
    const listRef = useRef<HTMLDivElement>(null)
    const [localValue, setLocalValue] = useState(value || min)

    const items: number[] = []
    for (let i = min; i <= max; i += step) {
        items.push(i)
    }

    const ITEM_HEIGHT = 60

    useEffect(() => {
        if (listRef.current) {
            const index = items.indexOf(value)
            if (index !== -1) {
                listRef.current.scrollTop = index * ITEM_HEIGHT
            }
        }
    }, [value]) // Re-sync if value changes externally

    const handleScroll = (e: any) => {
        const top = e.target.scrollTop
        const index = Math.round(top / ITEM_HEIGHT)
        const val = items[index]
        if (val !== undefined && val !== value) {
            onChange(val)
            setLocalValue(val)
        }
    }

    return (
        <div style={{ position: 'relative', height: ITEM_HEIGHT * 5, overflow: 'hidden', width: '100%', maxWidth: '200px', margin: '0 auto' }}>
            <div style={{
                position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0, height: ITEM_HEIGHT,
                background: 'rgba(255,255,255,0.08)', borderRadius: '16px', pointerEvents: 'none',
                zIndex: 0
            }} />

            <div
                ref={listRef}
                onScroll={handleScroll}
                style={{
                    height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory',
                    scrollbarWidth: 'none', msOverflowStyle: 'none',
                    position: 'relative', zIndex: 1
                }}
            >
                <div style={{ height: ITEM_HEIGHT * 2 }} />
                {items.map((item) => (
                    <div
                        key={item}
                        style={{
                            height: ITEM_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            scrollSnapAlign: 'center', fontSize: item === localValue ? '32px' : '22px',
                            fontWeight: item === localValue ? '800' : '500',
                            color: item === localValue ? '#fff' : '#444',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            gap: '8px'
                        }}
                    >
                        {item}
                        {item === localValue && unit && <span style={{ fontSize: '18px', color: '#666', fontWeight: '600', marginLeft: '8px' }}>{unit}</span>}
                    </div>
                ))}
                <div style={{ height: ITEM_HEIGHT * 2 }} />
            </div>
        </div>
    )
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter()
    const [isEditMode, setIsEditMode] = useState(false)
    const {
        profile, setProfile,
        onboardingStep: step, setOnboardingStep: setStep,
        onboardingForm, setOnboardingForm
    } = useAppStore()
    const [isSaving, setIsSaving] = useState(false)
    const [analysisProgress, setAnalysisProgress] = useState(0)

    const currentYear = new Date().getFullYear()

    // Safety: ensure all numeric values are numbers, not strings
    const initialForm = {
        name: profile?.name || '',
        goal: (profile?.goal as UserProfile['goal']) || 'maintenir',
        weight_kg: Number(profile?.weight_kg) || 70,
        target_weight_kg: Number(profile?.goal_weight_kg) || 65,
        height_cm: Number(profile?.height_cm) || 170,
        birth_year: profile?.age ? currentYear - profile.age : 1995,
        gender: (profile?.gender as 'homme' | 'femme') || 'homme',
        activity_level: (profile?.activity_level as UserProfile['activity_level']) || 'modere',
        eating_habits: [] as string[],
        preferred_cuisines: profile?.preferred_cuisines || [] as string[],
        target_weeks: 8,
        country: profile?.country || 'TG',
    }

    const form = onboardingForm || initialForm

    // Migration safety: if old form doesn't have birth_year but has age
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const edit = new URLSearchParams(window.location.search).get('edit') === '1'
            setIsEditMode(edit)
        }
    }, [])

    useEffect(() => {
        if (onboardingForm && !onboardingForm.birth_year && onboardingForm.age) {
            update('birth_year', currentYear - onboardingForm.age)
        }
    }, [])

    const update = (key: string, value: any) => {
        const newForm = { ...form, [key]: value }
        setOnboardingForm(newForm)
    }

    const toggleHabit = (id: string) => {
        const habits = form.eating_habits?.includes(id)
            ? form.eating_habits.filter((h: string) => h !== id)
            : [...(form.eating_habits || []), id]
        update('eating_habits', habits)
    }

    const next = () => setStep(step + 1)
    const back = () => setStep(step - 1)

    useEffect(() => {
        if (step === 9) {
            setAnalysisProgress(0)
            const interval = setInterval(() => {
                setAnalysisProgress(p => {
                    if (p >= 100) {
                        clearInterval(interval)
                        setTimeout(next, 800)
                        return 100
                    }
                    return p + 2
                })
            }, 50)
            return () => clearInterval(interval)
        }
    }, [step])

    const calculateSafeTargets = () => {
        try {
            const age = currentYear - (form.birth_year || 1995)
            return calculateCalorieTarget({
                age: isNaN(age) ? 25 : age,
                gender: form.gender || 'homme',
                weight_kg: Number(form.weight_kg) || 70,
                height_cm: Number(form.height_cm) || 170,
                activity_level: form.activity_level || 'modere',
                goal: form.goal || 'maintenir',
            })
        } catch (e) {
            return { calorie_target: 2000, protein_target_g: 150, carbs_target_g: 250, fat_target_g: 65 }
        }
    }

    const handleFinish = async () => {
        setIsSaving(true)
        try {
            const age = currentYear - (form.birth_year || 1995)
            const targets = calculateSafeTargets()

            const profileData = {
                name: form.name,
                age,
                gender: form.gender,
                weight_kg: Number(form.weight_kg),
                height_cm: Number(form.height_cm),
                activity_level: form.activity_level,
                goal: form.goal,
                country: form.country,
                preferred_cuisines: form.preferred_cuisines,
                subscription_tier: profile?.subscription_tier || 'free',
                ...targets,
            }

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: updated, error } = await supabase
                .from('user_profiles')
                .upsert({ user_id: session.user.id, ...profileData }, { onConflict: 'user_id' })
                .select().single()

            if (error) throw error
            setProfile(updated)
            setStep(0)
            setOnboardingForm(null)
            router.push('/dashboard')
        } catch (err) {
            console.error(err)
            alert('Erreur lors de la sauvegarde')
        } finally {
            setIsSaving(false)
        }
    }

    const liveResults = calculateSafeTargets()

    useEffect(() => {
        if (isEditMode && step > 10) {
            setStep(10)
        }
    }, [isEditMode, step, setStep])

    return (
        <div style={{
            minHeight: '100vh', background: '#000', color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 24px 100px',
            maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                * { -webkit-tap-highlight-color: transparent; }
                div::-webkit-scrollbar { display: none; }
            `}</style>

            {/* PROGRESS BAR */}
            {step < 10 && (
                <div style={{ width: '100%', height: '4px', background: '#111', borderRadius: '2px', marginBottom: '40px' }}>
                    <div style={{
                        width: `${(step / 10) * 100}%`, height: '100%',
                        background: 'linear-gradient(90deg, #22c55e, #10b981)',
                        borderRadius: '2px', transition: 'width 0.4s ease'
                    }} />
                </div>
            )}

            {/* 0. NOM */}
            {step === 0 && (
                <StepWrapper key="step0" title="Comment devons-nous vous appeler ?" icon="👋">
                    <input
                        autoFocus
                        type="text" value={form.name} onChange={e => update('name', e.target.value)}
                        placeholder="Votre prénom"
                        style={{ width: '100%', height: '64px', background: '#111', border: '1.5px solid #222', borderRadius: '18px', color: '#fff', padding: '0 24px', fontSize: '18px', outline: 'none' }}
                    />
                    <div style={{ marginTop: '20px' }}>
                        <NextButton disabled={!form.name} onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 1. COUNTRY */}
            {step === 1 && (
                <StepWrapper key="stepCountry" title="Dans quel pays habitez-vous ?" icon="🌍" sub="Yao adaptera ses conseils culinaires à votre région.">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {COUNTRIES.map(c => (
                            <button key={c.code} onClick={() => { update('country', c.label); next(); }} style={{
                                padding: '18px', background: form.country === c.label ? 'rgba(34,197,94,0.1)' : '#111',
                                border: form.country === c.label ? '1px solid #22c55e' : '1.5px solid #222',
                                borderRadius: '18px', cursor: 'pointer', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#fff'
                            }}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                </StepWrapper>
            )}

            {/* 2. OBJECTIF (Décalé de 1) */}
            {step === 2 && (
                <StepWrapper key="step1" title="Quel est votre objectif ?" icon="🎯">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                            { id: 'perdre', label: 'Perdre du poids', icon: '🔥' },
                            { id: 'maintenir', label: 'Maintenir mon poids', icon: '⚖️' },
                            { id: 'prendre', label: 'Prendre du muscle', icon: '💪' },
                        ].map(g => (
                            <button key={g.id} onClick={() => { update('goal', g.id); next(); }} style={{
                                padding: '24px', background: form.goal === g.id ? 'rgba(34,197,94,0.1)' : '#111',
                                border: form.goal === g.id ? '1px solid #22c55e' : '1.5px solid #222',
                                borderRadius: '18px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px'
                            }}>
                                <span style={{ fontSize: '26px' }}>{g.icon}</span>
                                <span style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{g.label}</span>
                            </button>
                        ))}
                    </div>
                </StepWrapper>
            )}

            {/* 3. POIDS (Décalé de 2) */}
            {step === 3 && (
                <StepWrapper key="step2" title="Quel est votre poids ?" sub="Une estimation suffit" icon="⚖️">
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <WheelPicker min={30} max={200} value={Number(form.weight_kg)} onChange={v => update('weight_kg', v)} unit="kg" />
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 4. TAILLE */}
            {step === 4 && (
                <StepWrapper key="step3" title="Quelle est votre taille ?" icon="📏">
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <WheelPicker min={100} max={250} value={Number(form.height_cm)} onChange={v => update('height_cm', v)} unit="cm" />
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 5. ANNEE DE NAISSANCE */}
            {step === 5 && (
                <StepWrapper key="step4" title="Votre année de naissance" icon="📅">
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <WheelPicker min={1920} max={2015} value={Number(form.birth_year)} onChange={v => update('birth_year', v)} />
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 6. ACTIVITÉ */}
            {step === 6 && (
                <StepWrapper key="step5" title="Votre niveau d'activité ?" icon="⚡">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                            { id: 'sedentaire', label: 'Sédentaire', sub: 'Bureau, peu de sport' },
                            { id: 'leger', label: 'Légèrement actif', sub: '1-2 fois / semaine' },
                            { id: 'modere', label: 'Modéré', sub: '3-5 fois / semaine' },
                            { id: 'actif', label: 'Très actif', sub: '6+ fois / semaine' },
                        ].map(a => (
                            <button key={a.id} onClick={() => { update('activity_level', a.id); next(); }} style={{
                                padding: '18px', background: form.activity_level === a.id ? 'rgba(34,197,94,0.1)' : '#111',
                                border: form.activity_level === a.id ? '1px solid #22c55e' : '1.5px solid #222',
                                borderRadius: '16px', textAlign: 'left'
                            }}>
                                <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600' }}>{a.label}</div>
                                <div style={{ color: '#666', fontSize: '13px' }}>{a.sub}</div>
                            </button>
                        ))}
                    </div>
                </StepWrapper>
            )}

            {/* 7. HABITUDES */}
            {step === 7 && (
                <StepWrapper key="step6" title="Vos habitudes ?" sub="Identifiez ce qui vous freine" icon="🍽️">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {EATING_HABITS.map(h => (
                            <button key={h.id} onClick={() => toggleHabit(h.id)} style={{
                                padding: '14px 22px', borderRadius: '32px', border: '1.5px solid #222',
                                background: form.eating_habits?.includes(h.id) ? '#fff' : 'transparent',
                                color: form.eating_habits?.includes(h.id) ? '#000' : '#888',
                                fontSize: '14px', fontWeight: '700', transition: 'all 0.2s'
                            }}>
                                {h.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 8. PRÉFÉRENCES */}
            {step === 8 && (
                <StepWrapper key="step7" title="Vos préférences" sub="Pour personnaliser vos repas" icon="🌍">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {CUISINES.map(c => (
                            <button key={c} onClick={() => {
                                const list = (form.preferred_cuisines || []).includes(c) ? form.preferred_cuisines.filter((x: string) => x !== c) : [...(form.preferred_cuisines || []), c]
                                update('preferred_cuisines', list)
                            }} style={{
                                padding: '18px', borderRadius: '14px', border: '1.5px solid #222',
                                background: (form.preferred_cuisines || []).includes(c) ? 'rgba(34,197,94,0.1)' : '#111',
                                color: (form.preferred_cuisines || []).includes(c) ? '#22c55e' : '#fff',
                                fontSize: '14px', fontWeight: '600'
                            }}>{c}</button>
                        ))}
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 9. PROJECTION */}
            {step === 9 && (
                <StepWrapper key="step8" title="Votre vision" icon="🎯">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {form.goal !== 'maintenir' && (
                            <div>
                                <label style={{ color: '#444', fontSize: '13px', display: 'block', marginBottom: '12px', fontWeight: '600' }}>POIDS CIBLE (KG)</label>
                                <input
                                    type="number" value={form.target_weight_kg} onChange={e => update('target_weight_kg', e.target.value)}
                                    placeholder="Ex: 65"
                                    style={{ width: '100%', height: '54px', background: '#111', border: '1.5px solid #222', borderRadius: '14px', color: '#fff', padding: '0 16px', fontSize: '18px', outline: 'none' }}
                                />
                            </div>
                        )}
                        <div>
                            <label style={{ color: '#444', fontSize: '13px', display: 'block', marginBottom: '12px', fontWeight: '600' }}>DURÉE ESTIMÉE (SEM.)</label>
                            <input
                                type="number" value={form.target_weeks} onChange={e => update('target_weeks', e.target.value)}
                                placeholder="Ex: 8"
                                style={{ width: '100%', height: '54px', background: '#111', border: '1.5px solid #222', borderRadius: '14px', color: '#fff', padding: '0 16px', fontSize: '18px', outline: 'none' }}
                            />
                        </div>
                    </div>
                    <div style={{ marginTop: '40px' }}>
                        <NextButton onClick={next} />
                    </div>
                </StepWrapper>
            )}

            {/* 10. ANALYSE */}
            {step === 10 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <div style={{ width: '120px', height: '120px', position: 'relative', marginBottom: '40px' }}>
                        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#111" strokeWidth="8" />
                            <circle 
                                cx="60" cy="60" r="54" fill="none" stroke="#22c55e" strokeWidth="8" 
                                strokeDasharray="339.292" 
                                strokeDashoffset={339.292 - (339.292 * analysisProgress) / 100} 
                                strokeLinecap="round" 
                                style={{ transition: 'stroke-dashoffset 0.1s linear' }} 
                            />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '24px', fontWeight: '900' }}>{analysisProgress}%</div>
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>Calcul de votre plan...</h3>
                    <p style={{ color: '#555', fontSize: '15px' }}>Analyse des besoins énergétiques</p>
                </div>
            )}

            {/* 11. RESULTATS WOW */}
            {step === 11 && (
                <StepWrapper key="step10" title="C'est prêt !" icon="🌟">
                    <div style={{ background: 'linear-gradient(135deg, #111, #080808)', border: '1.5px solid #222', borderRadius: '28px', padding: '40px 30px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '800', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Objectif Quotidien</div>
                        <div style={{ fontSize: '68px', fontWeight: '900', color: '#fff', letterSpacing: '-2px' }}>{liveResults.calorie_target}</div>
                        <div style={{ fontSize: '16px', color: '#666', marginBottom: '40px', fontWeight: '500' }}>Calories / jour</div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                            <div>
                                <div style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>{liveResults.protein_target_g}g</div>
                                <div style={{ color: '#555', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>Protéines</div>
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>{liveResults.carbs_target_g}g</div>
                                <div style={{ color: '#555', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>Glucides</div>
                            </div>
                            <div>
                                <div style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>{liveResults.fat_target_g}g</div>
                                <div style={{ color: '#555', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>Lipides</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <NextButton label={isEditMode ? "Terminer" : "Découvrir mon plan →"} onClick={isEditMode ? handleFinish : next} />
                    </div>
                </StepWrapper>
            )}

            {/* 12. PAYWALL */}
            {!isEditMode && step === 12 && (
                <StepWrapper key="step11" title="Libérez tout votre potentiel" icon="🚀">
                    <div style={{ padding: '24px', background: '#111', borderRadius: '20px', border: '1px solid #222', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                            <span style={{ fontWeight: '800', fontSize: '18px' }}>Premium Elite</span>
                            <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>Tout illimité</span>
                        </div>
                        <ul style={{ color: '#777', fontSize: '15px', listStyle: 'none', padding: 0 }}>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#22c55e' }}>✓</span> Coach Yao AI Illimité</li>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#22c55e' }}>✓</span> Scans photos illimités</li>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#22c55e' }}>✓</span> Statistiques & Graphiques</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#22c55e' }}>✓</span> Accès prioritaire 24/7</li>
                        </ul>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            disabled={isSaving}
                            onClick={() => router.push('/upgrade?hideFree=true')}
                            style={{ width: '100%', height: '56px', background: 'linear-gradient(90deg, #22c55e, #10b981)', color: '#000', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                            Voir les offres Premium
                        </button>
                        <button
                            disabled={isSaving}
                            onClick={handleFinish}
                            style={{ width: '100%', height: '56px', background: 'transparent', color: '#555', borderRadius: '18px', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '15px' }}>
                            Continuer gratuitement (limité)
                        </button>
                    </div>
                </StepWrapper>
            )}

            {/* BTN RETOUR */}
            {step > 0 && step < 9 && (
                <button onClick={back} style={{ position: 'fixed', bottom: '40px', left: '24px', background: 'transparent', border: 'none', color: '#444', fontSize: '14px', fontWeight: '700', cursor: 'pointer', zIndex: 10 }}>← Précédent</button>
            )}
        </div>
    )
}

// ─── COMPOSANTS AUXILIAIRES ───

function StepWrapper({ children, title, sub, icon }: { children: React.ReactNode, title: string, sub?: string, icon?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', animation: 'fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1)', flex: 1 }}>
            <div style={{ textAlign: 'center' }}>
                {icon && <div style={{ fontSize: '52px', marginBottom: '24px' }}>{icon}</div>}
                <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '900', marginBottom: '12px', letterSpacing: '-0.5px' }}>{title}</h2>
                {sub && <p style={{ color: '#555', fontSize: '16px', lineHeight: '1.6' }}>{sub}</p>}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>{children}</div>
        </div>
    )
}

function NextButton({ disabled = false, label = "Suivant", onClick }: { disabled?: boolean, label?: string, onClick: () => void }) {
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            style={{
                width: '100%', height: '58px', background: disabled ? '#111' : '#fff',
                color: disabled ? '#333' : '#000', borderRadius: '18px',
                fontSize: '17px', fontWeight: '800', cursor: disabled ? 'default' : 'pointer',
                border: 'none', transition: 'all 0.3s ease',
            }}
        >
            {label}
        </button>
    )
}