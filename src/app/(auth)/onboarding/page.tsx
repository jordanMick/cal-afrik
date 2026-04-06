'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { calculateCalorieTarget } from '@/lib/nutrition'
import { createClient } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'

const STEPS = ['Identité', 'Corps', 'Objectif', 'Cuisine']

const STEP_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']
const STEP_BG = ['rgba(99,102,241,0.12)', 'rgba(16,185,129,0.12)', 'rgba(245,158,11,0.12)', 'rgba(236,72,153,0.12)']

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
    const { profile, setProfile } = useAppStore()
    const [step, setStep] = useState(0)
    const [isSaving, setIsSaving] = useState(false)

    // Mode édition si un profil existe déjà
    const isEditMode = !!profile

    const [form, setForm] = useState({
        name: profile?.name || '',
        country: profile?.country || 'TG',
        age: profile?.age?.toString() || '',
        gender: (profile?.gender as 'homme' | 'femme' | 'autre') || 'homme',
        weight_kg: profile?.weight_kg?.toString() || '',
        height_cm: profile?.height_cm?.toString() || '',
        activity_level: (profile?.activity_level as UserProfile['activity_level']) || 'modere',
        goal: (profile?.goal as UserProfile['goal']) || 'maintenir',
        preferred_cuisines: profile?.preferred_cuisines || [] as string[],
        dietary_restrictions: profile?.dietary_restrictions || [] as string[],
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

    const handleCancel = () => {
        router.push('/profil')
    }

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

            const { data: updatedProfile, error } = await supabase
                .from('user_profiles')
                .upsert(
                    { user_id: session.user.id, ...profileData },
                    { onConflict: 'user_id' }
                )
                .select()
                .single()

            if (error) { alert('Erreur: ' + error.message); return }

            setProfile(updatedProfile)
            router.push(isEditMode ? '/profil' : '/dashboard')
        } catch (err) {
            console.error('Erreur:', err)
            alert('Erreur lors de la sauvegarde')
        } finally {
            setIsSaving(false)
        }
    }

    const activeColor = STEP_COLORS[step]
    const activeBg = STEP_BG[step]

    const inputStyle: React.CSSProperties = {
        width: '100%', height: '46px', padding: '0 14px',
        background: '#0f0f0f', border: '0.5px solid #2a2a2a',
        borderRadius: '10px', color: '#fff', fontSize: '14px',
        outline: 'none', boxSizing: 'border-box',
    }

    const labelStyle: React.CSSProperties = {
        display: 'block', color: '#666', fontSize: '12px',
        marginBottom: '6px', fontWeight: '500',
    }

    const btnActive = (color: string): React.CSSProperties => ({
        padding: '12px 14px',
        background: `${color}20`,
        border: `1px solid ${color}60`,
        borderRadius: '12px', color: '#fff',
        fontSize: '14px', fontWeight: '500',
        cursor: 'pointer', textAlign: 'left', width: '100%',
    })

    const btnInactive: React.CSSProperties = {
        padding: '12px 14px',
        background: '#141414', border: '0.5px solid #222',
        borderRadius: '12px', color: '#555',
        fontSize: '14px', fontWeight: '400',
        cursor: 'pointer', textAlign: 'left', width: '100%',
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            fontFamily: 'system-ui, sans-serif',
            padding: '48px 24px 120px',
            maxWidth: '480px',
            margin: '0 auto',
            position: 'relative',
            overflow: 'hidden',
        }}>

            {/* Halo de couleur en fond selon le step */}
            <div style={{
                position: 'fixed', top: '-80px', right: '-80px',
                width: '300px', height: '300px', borderRadius: '50%',
                background: `radial-gradient(circle, ${activeColor}18 0%, transparent 70%)`,
                pointerEvents: 'none',
                transition: 'background 0.5s ease',
            }} />

            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: `linear-gradient(135deg, ${activeColor}, ${STEP_COLORS[(step + 1) % 4]})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '17px', transition: 'background 0.4s ease',
                    }}>🌍</div>
                    <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>Cal Afrik</span>
                </div>

                {/* Bouton Annuler visible uniquement en mode édition */}
                {isEditMode && (
                    <button
                        onClick={handleCancel}
                        style={{
                            background: '#141414',
                            border: '0.5px solid #2a2a2a',
                            borderRadius: '10px',
                            color: '#666',
                            fontSize: '13px',
                            fontWeight: '500',
                            padding: '8px 14px',
                            cursor: 'pointer',
                        }}
                    >
                        Annuler
                    </button>
                )}
            </div>

            {/* Badge mode édition */}
            {isEditMode && (
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(99,102,241,0.1)',
                    border: '0.5px solid rgba(99,102,241,0.25)',
                    borderRadius: '20px',
                    marginBottom: '20px',
                }}>
                    <span style={{ fontSize: '11px' }}>✏️</span>
                    <span style={{ color: '#6366f1', fontSize: '12px', fontWeight: '500' }}>
                        Modification du profil
                    </span>
                </div>
            )}

            {/* PROGRESS STEPS */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '36px' }}>
                {STEPS.map((s, i) => (
                    <div key={s} style={{ flex: 1 }}>
                        <div style={{
                            height: '3px', borderRadius: '2px',
                            background: i < step ? STEP_COLORS[i] : i === step ? activeColor : '#1e1e1e',
                            marginBottom: '6px',
                            transition: 'background 0.3s ease',
                        }} />
                        <p style={{
                            color: i === step ? activeColor : i < step ? '#555' : '#333',
                            fontSize: '11px', fontWeight: i === step ? '600' : '400',
                            transition: 'color 0.3s ease',
                        }}>{s}</p>
                    </div>
                ))}
            </div>

            {/* ───── STEP 0 : IDENTITÉ ───── */}
            {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    <div>
                        <div style={{
                            display: 'inline-block', padding: '4px 12px',
                            background: STEP_BG[0], border: `0.5px solid ${STEP_COLORS[0]}40`,
                            borderRadius: '20px', marginBottom: '10px',
                        }}>
                            <span style={{ color: STEP_COLORS[0], fontSize: '11px', fontWeight: '600' }}>Étape 1 / 4</span>
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                            {isEditMode ? 'Votre identité' : 'Comment vous appelez-vous ?'}
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Dites-nous qui vous êtes</p>
                    </div>

                    <div>
                        <label style={labelStyle}>Prénom</label>
                        <input
                            type="text" value={form.name}
                            onChange={(e) => update('name', e.target.value)}
                            placeholder="Ex: Kofi, Aminata, Seydou..."
                            style={{
                                ...inputStyle,
                                border: form.name ? `0.5px solid ${STEP_COLORS[0]}60` : '0.5px solid #2a2a2a',
                            }}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Pays</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {COUNTRIES.map((c) => (
                                <button key={c.code} onClick={() => update('country', c.code)}
                                    style={form.country === c.code ? btnActive(STEP_COLORS[0]) : btnInactive}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ───── STEP 1 : CORPS ───── */}
            {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    <div>
                        <div style={{
                            display: 'inline-block', padding: '4px 12px',
                            background: STEP_BG[1], border: `0.5px solid ${STEP_COLORS[1]}40`,
                            borderRadius: '20px', marginBottom: '10px',
                        }}>
                            <span style={{ color: STEP_COLORS[1], fontSize: '11px', fontWeight: '600' }}>Étape 2 / 4</span>
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.3px' }}>
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
                                        padding: '12px 8px',
                                        background: form.gender === g.value ? STEP_BG[1] : '#141414',
                                        border: form.gender === g.value ? `1px solid ${STEP_COLORS[1]}60` : '0.5px solid #222',
                                        borderRadius: '10px',
                                        color: form.gender === g.value ? '#fff' : '#555',
                                        fontSize: '13px', fontWeight: '500', cursor: 'pointer',
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
                                <input
                                    type="number"
                                    value={form[field.key as keyof typeof form] as string}
                                    onChange={(e) => update(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    style={{
                                        ...inputStyle,
                                        border: (form[field.key as keyof typeof form] as string)
                                            ? `0.5px solid ${STEP_COLORS[1]}60`
                                            : '0.5px solid #2a2a2a',
                                    }}
                                />
                                <span style={{
                                    position: 'absolute', right: '14px',
                                    top: '50%', transform: 'translateY(-50%)',
                                    color: '#555', fontSize: '13px',
                                }}>{field.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ───── STEP 2 : OBJECTIF ───── */}
            {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    <div>
                        <div style={{
                            display: 'inline-block', padding: '4px 12px',
                            background: STEP_BG[2], border: `0.5px solid ${STEP_COLORS[2]}40`,
                            borderRadius: '20px', marginBottom: '10px',
                        }}>
                            <span style={{ color: STEP_COLORS[2], fontSize: '11px', fontWeight: '600' }}>Étape 3 / 4</span>
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                            Votre objectif
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Qu'est-ce que vous voulez accomplir ?</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                            { value: 'perdre', label: '⬇️ Perdre du poids', sub: 'Déficit de 400 kcal/jour' },
                            { value: 'maintenir', label: '➡️ Maintenir le poids', sub: 'Équilibre calorique' },
                            { value: 'prendre', label: '⬆️ Prendre du poids', sub: 'Surplus de 300 kcal/jour' },
                        ].map((g) => (
                            <button key={g.value} onClick={() => update('goal', g.value)} style={{
                                padding: '16px',
                                background: form.goal === g.value ? STEP_BG[2] : '#141414',
                                border: form.goal === g.value ? `1px solid ${STEP_COLORS[2]}60` : '0.5px solid #222',
                                borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                            }}>
                                <p style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>{g.label}</p>
                                <p style={{ color: form.goal === g.value ? STEP_COLORS[2] : '#444', fontSize: '12px' }}>{g.sub}</p>
                            </button>
                        ))}
                    </div>

                    <div>
                        <label style={{ ...labelStyle, marginBottom: '10px' }}>Niveau d'activité</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                                { value: 'sedentaire', label: '🪑 Sédentaire', sub: 'Bureau, peu de sport' },
                                { value: 'leger', label: '🚶 Légèrement actif', sub: '1-3 fois/semaine' },
                                { value: 'modere', label: '🏃 Modérément actif', sub: '3-5 fois/semaine' },
                                { value: 'actif', label: '💪 Très actif', sub: '6-7 fois/semaine' },
                                { value: 'tres_actif', label: '🔥 Extrêmement actif', sub: 'Sport intensif quotidien' },
                            ].map((a) => (
                                <button key={a.value} onClick={() => update('activity_level', a.value)} style={{
                                    padding: '12px 14px',
                                    background: form.activity_level === a.value ? STEP_BG[2] : '#141414',
                                    border: form.activity_level === a.value ? `1px solid ${STEP_COLORS[2]}60` : '0.5px solid #222',
                                    borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <div>
                                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{a.label}</p>
                                        <p style={{ color: '#444', fontSize: '11px', marginTop: '1px' }}>{a.sub}</p>
                                    </div>
                                    {form.activity_level === a.value && (
                                        <div style={{
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            background: STEP_COLORS[2],
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#000', fontSize: '10px', flexShrink: 0,
                                        }}>✓</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ───── STEP 3 : CUISINE ───── */}
            {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    <div>
                        <div style={{
                            display: 'inline-block', padding: '4px 12px',
                            background: STEP_BG[3], border: `0.5px solid ${STEP_COLORS[3]}40`,
                            borderRadius: '20px', marginBottom: '10px',
                        }}>
                            <span style={{ color: STEP_COLORS[3], fontSize: '11px', fontWeight: '600' }}>Étape 4 / 4</span>
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.3px' }}>
                            Vos préférences
                        </h2>
                        <p style={{ color: '#555', fontSize: '14px' }}>Pour personnaliser vos suggestions</p>
                    </div>

                    <div>
                        <label style={labelStyle}>Cuisines préférées</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {CUISINES.map((c) => (
                                <button key={c} onClick={() => toggleArray('preferred_cuisines', c)} style={{
                                    padding: '8px 14px',
                                    background: form.preferred_cuisines.includes(c) ? STEP_BG[3] : '#141414',
                                    border: form.preferred_cuisines.includes(c)
                                        ? `1px solid ${STEP_COLORS[3]}60`
                                        : '0.5px solid #222',
                                    borderRadius: '20px',
                                    color: form.preferred_cuisines.includes(c) ? '#fff' : '#555',
                                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                                }}>{c}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Restrictions alimentaires</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {RESTRICTIONS.map((r) => (
                                <button key={r} onClick={() => toggleArray('dietary_restrictions', r)} style={{
                                    padding: '8px 14px',
                                    background: form.dietary_restrictions.includes(r) ? 'rgba(16,185,129,0.12)' : '#141414',
                                    border: form.dietary_restrictions.includes(r)
                                        ? '1px solid rgba(16,185,129,0.4)'
                                        : '0.5px solid #222',
                                    borderRadius: '20px',
                                    color: form.dietary_restrictions.includes(r) ? '#10b981' : '#555',
                                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                                }}>{r}</button>
                            ))}
                        </div>
                    </div>

                    {/* Récap avant de valider */}
                    {form.name && (
                        <div style={{
                            background: '#141414', border: '0.5px solid #222',
                            borderRadius: '14px', padding: '16px',
                        }}>
                            <p style={{ color: '#555', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Récapitulatif</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { label: 'Prénom', value: form.name },
                                    { label: 'Âge', value: form.age ? `${form.age} ans` : '—' },
                                    { label: 'Poids', value: form.weight_kg ? `${form.weight_kg} kg` : '—' },
                                    { label: 'Objectif', value: form.goal === 'perdre' ? 'Perdre' : form.goal === 'prendre' ? 'Prendre' : 'Maintenir' },
                                ].map(item => (
                                    <div key={item.label}>
                                        <p style={{ color: '#333', fontSize: '10px' }}>{item.label}</p>
                                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BOUTONS NAVIGATION — fixed en bas */}
            <div style={{
                position: 'fixed', bottom: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: '100%', maxWidth: '480px',
                padding: '14px 24px 28px',
                background: 'linear-gradient(to top, #0a0a0a 80%, transparent)',
                display: 'flex', gap: '10px',
            }}>
                {/* Annuler (step 0 en mode édition) ou Retour (steps suivants) */}
                {step === 0 && isEditMode ? (
                    <button onClick={handleCancel} style={{
                        flex: 1, height: '48px',
                        background: '#141414', border: '0.5px solid #2a2a2a',
                        borderRadius: '12px', color: '#666',
                        fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                    }}>Annuler</button>
                ) : step > 0 ? (
                    <button onClick={() => setStep(step - 1)} style={{
                        flex: 1, height: '48px',
                        background: '#141414', border: '0.5px solid #222',
                        borderRadius: '12px', color: '#fff',
                        fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                    }}>← Retour</button>
                ) : null}

                <button
                    onClick={() => step < STEPS.length - 1 ? setStep(step + 1) : handleFinish()}
                    disabled={isSaving}
                    style={{
                        flex: 2, height: '48px',
                        background: isSaving
                            ? '#1e1e1e'
                            : `linear-gradient(135deg, ${activeColor}, ${STEP_COLORS[(step + 1) % 4]})`,
                        border: 'none', borderRadius: '12px',
                        color: isSaving ? '#444' : '#fff',
                        fontSize: '14px', fontWeight: '600',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        transition: 'background 0.4s ease',
                    }}>
                    {step < STEPS.length - 1
                        ? 'Continuer →'
                        : isSaving
                            ? 'Sauvegarde...'
                            : isEditMode ? 'Enregistrer ✓' : 'Commencer 🚀'}
                </button>
            </div>
        </div>
    )
}