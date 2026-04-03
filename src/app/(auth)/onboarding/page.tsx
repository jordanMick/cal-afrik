'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { calculateCalorieTarget } from '@/lib/nutrition'
import { createClient } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'

const STEPS = ['Identité', 'Corps', 'Objectif', 'Cuisine']

const COUNTRIES = [
    { code: 'TG', name: '🇹🇬 Togo' },
    { code: 'CI', name: '🇨🇮 Côte d\'Ivoire' },
    { code: 'SN', name: '🇸🇳 Sénégal' },
    { code: 'GH', name: '🇬🇭 Ghana' },
    { code: 'BJ', name: '🇧🇯 Bénin' },
    { code: 'BF', name: '🇧🇫 Burkina Faso' },
    { code: 'ML', name: '🇲🇱 Mali' },
    { code: 'NG', name: '🇳🇬 Nigeria' },
    { code: 'CM', name: '🇨🇲 Cameroun' },
    { code: 'Other', name: '🌍 Autre' },
]

const CUISINES = ['Togolaise', 'Ivoirienne', 'Sénégalaise', 'Ghanéenne', 'Béninoise', 'Malienne', 'Nigériane', 'Camerounaise']
const RESTRICTIONS = ['Halal', 'Sans porc', 'Végétarien', 'Sans gluten', 'Épicé']

export default function OnboardingPage() {
    const router = useRouter()
    const { setProfile } = useAppStore()
    const [step, setStep] = useState(0)
    const [isSaving, setIsSaving] = useState(false)

    const [form, setForm] = useState({
        name: '',
        country: 'TG',
        age: '',
        gender: 'homme' as 'homme' | 'femme' | 'autre',
        weight_kg: '',
        height_cm: '',
        activity_level: 'modere' as UserProfile['activity_level'],
        goal: 'maintenir' as UserProfile['goal'],
        preferred_cuisines: [] as string[],
        dietary_restrictions: [] as string[],
    })

    const update = (key: string, value: any) =>
        setForm((prev) => ({ ...prev, [key]: value }))

    const toggleArray = (key: 'preferred_cuisines' | 'dietary_restrictions', value: string) => {
        setForm((prev) => ({
            ...prev,
            [key]: prev[key].includes(value)
                ? prev[key].filter((v) => v !== value)
                : [...prev[key], value],
        }))
    }

    const getSupabase = () => createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleFinish = async () => {
        setIsSaving(true)
        try {
            const targets = calculateCalorieTarget({
                age: Number(form.age),
                gender: form.gender === 'autre' ? 'homme' : form.gender,
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
                country: form.country,
                preferred_cuisines: form.preferred_cuisines,
                dietary_restrictions: form.dietary_restrictions,
                language: 'fr',
                ...targets,
            }

            const supabase = getSupabase()
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                alert('Session expirée, reconnectez-vous')
                router.push('/login')
                return
            }

            const { data: profile, error } = await supabase
                .from('user_profiles')
                .upsert({ user_id: session.user.id, ...profileData })
                .select()
                .single()

            if (error) {
                alert('Erreur: ' + error.message)
                return
            }

            setProfile(profile)
            router.push('/dashboard')
        } catch (err) {
            console.error('Erreur:', err)
            alert('Erreur lors de la sauvegarde')
        } finally {
            setIsSaving(false)
        }
    }

    const inputStyle = {
        width: '100%',
        height: '48px',
        padding: '0 16px',
        background: '#0F0A06',
        border: '1px solid #2A1F14',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box' as const,
    }

    const labelStyle = {
        display: 'block',
        color: '#999',
        fontSize: '13px',
        marginBottom: '8px',
    }

    const btnActive = {
        padding: '12px 16px',
        background: '#C4622D',
        border: 'none',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        textAlign: 'left' as const,
        width: '100%',
    }

    const btnInactive = {
        padding: '12px 16px',
        background: '#1A1108',
        border: '1px solid #2A1F14',
        borderRadius: '12px',
        color: '#999',
        fontSize: '14px',
        fontWeight: '400',
        cursor: 'pointer',
        textAlign: 'left' as const,
        width: '100%',
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0F0A06',
            fontFamily: 'system-ui, sans-serif',
            padding: '48px 24px 120px',
            maxWidth: '480px',
            margin: '0 auto',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: '#C4622D',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                }}>🌍</div>
                <span style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>Cal Afrik</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
                {STEPS.map((s, i) => (
                    <div key={s} style={{ flex: 1 }}>
                        <div style={{
                            height: '3px', borderRadius: '2px',
                            background: i <= step ? '#C4622D' : '#2A1F14',
                            marginBottom: '6px',
                        }} />
                        <p style={{
                            color: i === step ? '#C4622D' : '#444',
                            fontSize: '11px',
                            fontWeight: i === step ? '700' : '400',
                        }}>{s}</p>
                    </div>
                ))}
            </div>

            {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>
                            Comment vous appelez-vous ?
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Dites-nous qui vous êtes</p>
                    </div>
                    <div>
                        <label style={labelStyle}>Prénom</label>
                        <input type="text" value={form.name}
                            onChange={(e) => update('name', e.target.value)}
                            placeholder="Ex: Kofi, Aminata, Seydou..."
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Pays</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {COUNTRIES.map((c) => (
                                <button key={c.code} onClick={() => update('country', c.code)}
                                    style={form.country === c.code ? btnActive : btnInactive}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>
                            Votre corps
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Pour calculer vos besoins caloriques</p>
                    </div>
                    <div>
                        <label style={labelStyle}>Genre</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {[
                                { value: 'homme', label: '👨 Homme' },
                                { value: 'femme', label: '👩 Femme' },
                                { value: 'autre', label: '🧑 Autre' },
                            ].map((g) => (
                                <button key={g.value} onClick={() => update('gender', g.value)}
                                    style={{
                                        padding: '12px',
                                        background: form.gender === g.value ? '#C4622D' : '#1A1108',
                                        border: `1px solid ${form.gender === g.value ? '#C4622D' : '#2A1F14'}`,
                                        borderRadius: '12px',
                                        color: form.gender === g.value ? '#fff' : '#999',
                                        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    }}>{g.label}</button>
                            ))}
                        </div>
                    </div>
                    {[
                        { key: 'age', label: 'Âge', placeholder: 'Ex: 28', unit: 'ans' },
                        { key: 'weight_kg', label: 'Poids', placeholder: 'Ex: 70', unit: 'kg' },
                        { key: 'height_cm', label: 'Taille', placeholder: 'Ex: 175', unit: 'cm' },
                    ].map((field) => (
                        <div key={field.key}>
                            <label style={labelStyle}>{field.label}</label>
                            <div style={{ position: 'relative' }}>
                                <input type="number"
                                    value={form[field.key as keyof typeof form] as string}
                                    onChange={(e) => update(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    style={inputStyle}
                                />
                                <span style={{
                                    position: 'absolute', right: '16px',
                                    top: '50%', transform: 'translateY(-50%)',
                                    color: '#555', fontSize: '13px',
                                }}>{field.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>
                            Votre objectif
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Qu'est-ce que vous voulez accomplir ?</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                            { value: 'perdre', label: '⬇️ Perdre du poids', sub: 'Déficit de 400 kcal/jour' },
                            { value: 'maintenir', label: '➡️ Maintenir le poids', sub: 'Équilibre calorique' },
                            { value: 'prendre', label: '⬆️ Prendre du poids', sub: 'Surplus de 300 kcal/jour' },
                        ].map((g) => (
                            <button key={g.value} onClick={() => update('goal', g.value)}
                                style={{
                                    padding: '16px',
                                    background: form.goal === g.value ? '#C4622D' : '#1A1108',
                                    border: `1px solid ${form.goal === g.value ? '#C4622D' : '#2A1F14'}`,
                                    borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                                }}>
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{g.label}</p>
                                <p style={{ color: form.goal === g.value ? 'rgba(255,255,255,0.7)' : '#555', fontSize: '12px' }}>{g.sub}</p>
                            </button>
                        ))}
                    </div>
                    <div>
                        <label style={{ ...labelStyle, marginBottom: '12px' }}>Niveau d'activité</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { value: 'sedentaire', label: '🪑 Sédentaire', sub: 'Bureau, peu de sport' },
                                { value: 'leger', label: '🚶 Légèrement actif', sub: '1-3 fois/semaine' },
                                { value: 'modere', label: '🏃 Modérément actif', sub: '3-5 fois/semaine' },
                                { value: 'actif', label: '💪 Très actif', sub: '6-7 fois/semaine' },
                                { value: 'tres_actif', label: '🔥 Extrêmement actif', sub: 'Sport intensif quotidien' },
                            ].map((a) => (
                                <button key={a.value} onClick={() => update('activity_level', a.value)}
                                    style={{
                                        padding: '14px 16px', background: '#1A1108',
                                        border: `1px solid ${form.activity_level === a.value ? '#C4622D' : '#2A1F14'}`,
                                        borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    }}>
                                    <div>
                                        <p style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{a.label}</p>
                                        <p style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{a.sub}</p>
                                    </div>
                                    {form.activity_level === a.value && (
                                        <div style={{
                                            width: '20px', height: '20px', borderRadius: '50%',
                                            background: '#C4622D', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontSize: '11px', flexShrink: 0,
                                        }}>✓</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>
                            Vos préférences
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Pour personnaliser vos suggestions</p>
                    </div>
                    <div>
                        <label style={labelStyle}>Cuisines préférées</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {CUISINES.map((c) => (
                                <button key={c} onClick={() => toggleArray('preferred_cuisines', c)}
                                    style={{
                                        padding: '8px 16px',
                                        background: form.preferred_cuisines.includes(c) ? '#C4622D' : '#1A1108',
                                        border: `1px solid ${form.preferred_cuisines.includes(c) ? '#C4622D' : '#2A1F14'}`,
                                        borderRadius: '20px',
                                        color: form.preferred_cuisines.includes(c) ? '#fff' : '#999',
                                        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    }}>{c}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Restrictions alimentaires</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {RESTRICTIONS.map((r) => (
                                <button key={r} onClick={() => toggleArray('dietary_restrictions', r)}
                                    style={{
                                        padding: '8px 16px',
                                        background: form.dietary_restrictions.includes(r) ? '#2D6A4F' : '#1A1108',
                                        border: `1px solid ${form.dietary_restrictions.includes(r) ? '#2D6A4F' : '#2A1F14'}`,
                                        borderRadius: '20px',
                                        color: form.dietary_restrictions.includes(r) ? '#fff' : '#999',
                                        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                                    }}>{r}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div style={{
                position: 'fixed', bottom: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: '100%', maxWidth: '480px',
                padding: '16px 24px',
                background: '#0F0A06',
                borderTop: '1px solid #2A1F14',
                display: 'flex', gap: '12px',
            }}>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)}
                        style={{
                            flex: 1, height: '50px', background: '#1A1108',
                            border: '1px solid #2A1F14', borderRadius: '14px',
                            color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                        }}>← Retour</button>
                )}
                <button
                    onClick={() => step < STEPS.length - 1 ? setStep(step + 1) : handleFinish()}
                    disabled={isSaving}
                    style={{
                        flex: 1, height: '50px',
                        background: isSaving ? '#5A3520' : '#C4622D',
                        border: 'none', borderRadius: '14px',
                        color: '#fff', fontSize: '15px', fontWeight: '700',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}>
                    {step < STEPS.length - 1 ? 'Continuer →' : isSaving ? 'Création...' : 'Commencer 🚀'}
                </button>
            </div>
        </div>
    )
}