'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Bell, Clock, Droplets, Trophy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'

export default function NotificationsPage() {
    const router = useRouter()
    const { profile, setProfile } = useAppStore()
    const [loading, setLoading] = useState(false)
    
    const [reminders, setReminders] = useState({
        repas: true,
        hydratation: false,
        bilan: true,
        abonnement: true
    })
    const [saved, setSaved] = useState(false)

    // Synchronisation si le profil change
    useEffect(() => {
        if (profile) {
            setReminders({
                repas: profile.notify_meals ?? true,
                hydratation: profile.notify_hydration ?? false,
                bilan: profile.notify_reports ?? true,
                abonnement: profile.notify_subscription ?? true
            })
        }
    }, [profile])

    const toggle = (key: keyof typeof reminders) => {
        setReminders(prev => ({ ...prev, [key]: !prev[key] }))
        setSaved(false)
    }

    const handleSave = async () => {
        setLoading(true)
        setSaved(false)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/user', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}` 
                },
                body: JSON.stringify({ 
                    ...profile,
                    notify_meals: reminders.repas,
                    notify_hydration: reminders.hydratation,
                    notify_reports: reminders.bilan,
                    notify_subscription: reminders.abonnement
                })
            })
            const json = await res.json()
            if (json.success) {
                setProfile(json.data)
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (err) {
            console.error('Update notifications error:', err)
        } finally {
            setLoading(false)
        }
    }

    const ToggleSwitch = ({ active }: { active: boolean }) => (
        <div style={{
            width: '44px', height: '24px', borderRadius: '12px',
            background: active ? 'var(--success)' : 'var(--bg-tertiary)',
            position: 'relative', cursor: 'pointer',
            transition: 'background 0.3s ease'
        }}>
            <div style={{
                width: '18px', height: '18px', borderRadius: '9px', background: '#fff',
                position: 'absolute', top: '3px',
                left: active ? '23px' : '3px',
                transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', position: 'relative' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Notifications</h1>
            </div>

            <div style={{ padding: '0 20px', marginTop: '10px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
                    Choisis ce que Coach Yao peut t'envoyer. Rester régulier est la clé de tes objectifs.
                </p>

                {/* Section Rappels Quotidiens */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Rappels Quotidiens</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden', marginBottom: '28px' }}>
                    
                    <div onClick={() => toggle('repas')} style={{ width: '100%', padding: '16px 20px', borderBottom: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={16} color="#f59e0b" />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Heures de Repas</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Ne pas oublier de scanner</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.repas} />
                    </div>

                    <div onClick={() => toggle('hydratation')} style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Droplets size={16} color="#3b82f6" />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Hydratation</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Boire de l'eau régulièrement</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.hydratation} />
                    </div>

                </div>

                {/* Section Coach Yao */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Mises à jour</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden' }}>
                    
                    <div onClick={() => toggle('bilan')} style={{ width: '100%', padding: '16px 20px', borderBottom: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trophy size={16} color="#818cf8" />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Bilan de Soirée</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Les analyses de Yao</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.bilan} />
                    </div>

                    <div onClick={() => toggle('abonnement')} style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Bell size={16} color="#ef4444" />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Abonnement</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Alertes d'expiration</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.abonnement} />
                    </div>

                </div>

            </div>

            {/* Bottom Save Button */}
            <div style={{ position: 'fixed', bottom: '20px', left: '0', right: '0', padding: '0 20px', maxWidth: '480px', margin: '0 auto' }}>
                <button 
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                        width: '100%',
                        background: saved ? 'var(--success)' : 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        padding: '18px',
                        fontSize: '16px',
                        fontWeight: '700',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {loading ? (
                        'Enregistrement...'
                    ) : saved ? (
                        <>
                            <Check size={20} />
                            Enregistré !
                        </>
                    ) : (
                        'Enregistrer les modifications'
                    )}
                </button>
            </div>
        </div>
    )
}
