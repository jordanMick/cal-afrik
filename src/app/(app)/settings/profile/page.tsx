'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Pencil, Mail, Key, Check, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const GOAL_LABELS: Record<string, string> = { perdre: 'Perdre du poids', maintenir: 'Maintenir le poids', prendre: 'Prendre du poids' }
const ACTIVITY_LABELS: Record<string, string> = { sedentaire: 'Sédentaire', leger: 'Légèrement actif', modere: 'Modérément actif', actif: 'Très actif', tres_actif: 'Extrêmement actif' }
const STAT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']

export default function PersonalInfoPage() {
    const router = useRouter()
    const { profile } = useAppStore()

    const [userEmail, setUserEmail] = useState<string>('')

    const [isEditingPassword, setIsEditingPassword] = useState(false)
    const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmNew: '' })
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(false)

    const [isEditingEmail, setIsEditingEmail] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [stepEmail, setStepEmail] = useState(1) // 1: input, 2: otp
    const [emailError, setEmailError] = useState('')
    const [emailSuccess, setEmailSuccess] = useState('')
    const [emailLoading, setEmailLoading] = useState(false)
    const [otp, setOtp] = useState(['', '', '', '', '', '', '', ''])
    const otpRefs = useRef<(HTMLInputElement | null)[]>(new Array(8).fill(null))

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) setUserEmail(user.email)
        }
        fetchUser()
    }, [])

    const handleUpdatePassword = async () => {
        setPasswordError('')
        setPasswordSuccess('')
        if (!passwordForm.oldPassword || !passwordForm.newPassword) return setPasswordError("Veuillez remplir tous les champs.")
        if (passwordForm.newPassword !== passwordForm.confirmNew) return setPasswordError("Les mots de passe ne correspondent pas.")
        if (passwordForm.newPassword.length < 6) return setPasswordError("Le mot de passe doit faire au moins 6 caractères.")

        setPasswordLoading(true)
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password: passwordForm.oldPassword })
            if (signInError) throw new Error("L'ancien mot de passe est incorrect.")

            const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
            if (updateError) throw updateError

            setPasswordSuccess("Mot de passe mis à jour !")
            setTimeout(() => {
                setIsEditingPassword(false)
                setPasswordForm({ oldPassword: '', newPassword: '', confirmNew: '' })
                setPasswordSuccess('')
            }, 2000)
        } catch (err: any) {
            let msg = err.message
            if (msg.includes('Invalid login credentials')) msg = "L'ancien mot de passe est incorrect."
            else if (msg.includes('rate limit')) msg = "Trop de tentatives. Veuillez patienter."
            else if (msg.includes('should be at least')) msg = "Le mot de passe est trop court."
            setPasswordError(msg || "Erreur lors de la mise à jour du mot de passe.")
        } finally {
            setPasswordLoading(false)
        }
    }

    const handleRequestEmailChange = async () => {
        if (!newEmail || !newEmail.includes('@')) return setEmailError("Veuillez entrer un email valide.")
        setEmailLoading(true)
        setEmailError('')
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail })
            if (error) throw error
            setStepEmail(2)
            toast.success("Code envoyé !")
        } catch (err: any) {
            setEmailError(err.message || "Erreur lors de l'envoi du code.")
        } finally {
            setEmailLoading(false)
        }
    }

    const handleVerifyEmailOTP = async () => {
        const token = otp.join('')
        if (token.length < 8) return
        setEmailLoading(true)
        setEmailError('')
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: newEmail,
                token,
                type: 'email_change'
            })
            if (error) throw error
            setEmailSuccess("Email mis à jour ! 🎉")
            setUserEmail(newEmail)
            setTimeout(() => {
                setIsEditingEmail(false)
                setStepEmail(1)
                setEmailSuccess('')
            }, 2000)
        } catch (err: any) {
            setEmailError("Code invalide ou expiré ❌")
        } finally {
            setEmailLoading(false)
        }
    }

    const handleOtpChange = (value: string, index: number) => {
        if (!/^\d*$/.test(value)) return
        const newOtp = [...otp]
        newOtp[index] = value.slice(-1)
        setOtp(newOtp)
        if (value && index < 7) otpRefs.current[index + 1]?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    const maskEmail = (email: string) => {
        if (!email) return ''
        const [name, domain] = email.split('@')
        if (!domain) return email
        if (name.length <= 3) return email
        const firstTwo = name.substring(0, 2)
        const lastOne = name.substring(name.length - 1)
        const maskedName = `${firstTwo}${'*'.repeat(Math.max(0, name.length - 3))}${lastOne}`
        return `${maskedName}@${domain}`
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Infos personnelles</h1>
            </div>

            <div style={{ padding: '0 20px', marginTop: '10px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Sécurité et Connexion</p>
                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden' }}>
                    {/* EMAIL */}
                    <div style={{ padding: '16px', borderBottom: '0.5px solid var(--border-color)' }}>
                        {!isEditingEmail ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={16} color="#6366f1" /></div>
                                    <div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>Adresse email</p>
                                        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>{maskEmail(userEmail)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditingEmail(true)} style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Modifier</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Modifier l'email</span>
                                    <button onClick={() => { setIsEditingEmail(false); setStepEmail(1); setEmailError(''); setEmailSuccess('') }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} color="var(--text-muted)" /></button>
                                </div>
                                
                                {stepEmail === 1 ? (
                                    <>
                                        <input type="email" placeholder="Nouvelle adresse email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px' }} />
                                        {emailError && <p style={{ color: 'var(--danger)', fontSize: '12px' }}>{emailError}</p>}
                                        <button onClick={handleRequestEmailChange} disabled={emailLoading} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #065f46, #10b981)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                                            {emailLoading ? 'Chargement...' : 'Recevoir le code'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>Saisis le code reçu sur {newEmail}</p>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                            {otp.map((digit, i) => (
                                                <input
                                                    key={i}
                                                    ref={el => { if (el) otpRefs.current[i] = el }}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={digit}
                                                    onChange={e => handleOtpChange(e.target.value, i)}
                                                    onKeyDown={e => handleKeyDown(e, i)}
                                                    style={{ width: '32px', height: '44px', textAlign: 'center', fontSize: '16px', fontWeight: '700', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '8px', color: '#10b981', outline: 'none' }}
                                                />
                                            ))}
                                        </div>
                                        {emailError && <p style={{ color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>{emailError}</p>}
                                        {emailSuccess && <p style={{ color: 'var(--success)', fontSize: '12px', textAlign: 'center' }}>{emailSuccess}</p>}
                                        <button onClick={handleVerifyEmailOTP} disabled={emailLoading || !!emailSuccess} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #065f46, #10b981)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                                            {emailLoading ? 'Vérification...' : 'Confirmer le changement'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PASSWORD */}
                    <div style={{ padding: '16px' }}>
                        {!isEditingPassword ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Key size={16} color="#10b981" /></div>
                                    <div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>Mot de passe</p>
                                        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>********</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditingPassword(true)} style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Modifier</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Modifier le mot de passe</span>
                                    <button onClick={() => setIsEditingPassword(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} color="var(--text-muted)" /></button>
                                </div>
                                <input type="password" placeholder="Ancien mot de passe" value={passwordForm.oldPassword} onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})} style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px' }} />
                                <input type="password" placeholder="Nouveau mot de passe" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px' }} />
                                <input type="password" placeholder="Confirmer le nouveau" value={passwordForm.confirmNew} onChange={e => setPasswordForm({...passwordForm, confirmNew: e.target.value})} style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px' }} />
                                {passwordError && <p style={{ color: 'var(--danger)', fontSize: '12px' }}>{passwordError}</p>}
                                {passwordSuccess && <p style={{ color: 'var(--success)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> {passwordSuccess}</p>}
                                <button onClick={handleUpdatePassword} disabled={passwordLoading || !!passwordSuccess} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #065f46, #10b981)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                                    {passwordLoading ? 'Chargement...' : 'Enregistrer'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Mes données</p>

                <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden' }}>
                    {[
                        { label: 'Âge', value: profile?.age ? `${profile.age} ans` : '—', icon: '👤' },
                        { label: 'Sexe', value: profile?.gender === 'femme' ? 'Femme' : 'Homme', icon: '🚻' },
                        { label: 'Pays', value: profile?.country || '—', icon: '🌍' },
                        { label: 'Poids', value: profile?.weight_kg ? `${profile.weight_kg} kg` : '—', icon: '⚖️' },
                        { label: 'Poids cible', value: profile?.goal_weight_kg ? `${profile.goal_weight_kg} kg` : '—', icon: '🎯', hidden: profile?.goal === 'maintenir' },
                        { label: 'Taille', value: profile?.height_cm ? `${profile.height_cm} cm` : '—', icon: '📏' },
                        { label: 'Activité', value: profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—', icon: '⚡' },
                        { label: 'Objectif', value: profile?.goal ? GOAL_LABELS[profile.goal] : '—', icon: '📈' },
                    ].filter(item => !item.hidden).map((item, i, arr) => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border-color)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{item.label}</span>
                            </div>
                            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
                    <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Cuisines préférées</p>
                        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                            {profile.preferred_cuisines.map((c, i) => {
                                const color = STAT_COLORS[i % STAT_COLORS.length]
                                return (
                                    <span key={c} style={{ padding: '8px 16px', background: `${color}12`, border: `0.5px solid ${color}40`, borderRadius: '20px', color: color, fontSize: '13px', fontWeight: '600' }}>
                                        {c}
                                    </span>
                                )
                            })}
                        </div>
                    </>
                )}

                {profile?.dietary_restrictions && profile.dietary_restrictions.length > 0 && (
                    <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Restrictions & Allergies</p>
                        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
                            {profile.dietary_restrictions.map((r, i) => (
                                <span key={r} style={{ padding: '8px 16px', background: 'rgba(var(--danger-rgb), 0.1)', border: '0.5px solid rgba(var(--danger-rgb), 0.4)', borderRadius: '20px', color: 'var(--danger)', fontSize: '13px', fontWeight: '600' }}>
                                    {r}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                <button
                    onClick={() => router.push('/onboarding?edit=1')}
                    style={{ width: '100%', padding: '16px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' }}
                >
                    <Pencil size={18} />
                    Mettre à jour mes informations
                </button>
            </div>
        </div>
    )
}