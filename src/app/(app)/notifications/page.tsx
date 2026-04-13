'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Bell, Clock, Droplets, Trophy } from 'lucide-react'
import { useState } from 'react'

export default function NotificationsPage() {
    const router = useRouter()
    
    // Simulations d'états (non reliés à une DB pour l'instant)
    const [reminders, setReminders] = useState({
        repas: true,
        hydratation: false,
        bilan: true,
        abonnement: true
    })

    const toggle = (key: keyof typeof reminders) => {
        setReminders(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const ToggleSwitch = ({ active }: { active: boolean }) => (
        <div style={{
            width: '44px', height: '24px', borderRadius: '12px',
            background: active ? '#10b981' : '#333',
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
        <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="#fff" size={24} />
                </button>
                <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '800' }}>Notifications</h1>
            </div>

            <div style={{ padding: '0 20px', marginTop: '10px' }}>
                <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
                    Choisis ce que Coach Yao peut t'envoyer. Rester régulier est la clé de tes objectifs.
                </p>

                {/* Section Rappels Quotidiens */}
                <p style={{ color: '#666', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Rappels Quotidiens</p>
                <div style={{ background: '#121212', borderRadius: '16px', border: '0.5px solid #222', overflow: 'hidden', marginBottom: '28px' }}>
                    
                    <div onClick={() => toggle('repas')} style={{ width: '100%', padding: '16px 20px', borderBottom: '0.5px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={16} color="#f59e0b" />
                            </div>
                            <div>
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Heures de Repas</p>
                                <p style={{ color: '#666', fontSize: '12px' }}>Ne pas oublier de scanner</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.repas} />
                    </div>

                    <div onClick={() => toggle('hydratation')} style={{ width: '100%', padding: '16px 20px', borderBottom: '0.5px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Droplets size={16} color="#3b82f6" />
                            </div>
                            <div>
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Hydratation</p>
                                <p style={{ color: '#666', fontSize: '12px' }}>Penser à boire de l'eau</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.hydratation} />
                    </div>

                </div>

                {/* Section Coach Yao */}
                <p style={{ color: '#666', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Mises à jour</p>
                <div style={{ background: '#121212', borderRadius: '16px', border: '0.5px solid #222', overflow: 'hidden' }}>
                    
                    <div onClick={() => toggle('bilan')} style={{ width: '100%', padding: '16px 20px', borderBottom: '0.5px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trophy size={16} color="#818cf8" />
                            </div>
                            <div>
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Bilan de Soirée</p>
                                <p style={{ color: '#666', fontSize: '12px' }}>Les analyses de Yao</p>
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
                                <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Abonnement</p>
                                <p style={{ color: '#666', fontSize: '12px' }}>Alertes d'expiration</p>
                            </div>
                        </div>
                        <ToggleSwitch active={reminders.abonnement} />
                    </div>

                </div>

            </div>
        </div>
    )
}
