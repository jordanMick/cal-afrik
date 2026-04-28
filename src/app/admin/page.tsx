'use client'

import { useEffect, useState } from 'react'
import { 
    Users, 
    Zap, 
    Camera, 
    CreditCard, 
    ArrowUpRight, 
    Search,
    Filter,
    MoreHorizontal,
    Activity,
    TrendingUp,
    Clock,
    UserCheck,
    Globe
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('general') // 'general', 'users', 'payments'

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/admin/stats', {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            })
            const json = await res.json()
            if (json.success) {
                setData(json)
            }
        } catch (err) {
            console.error('Fetch admin stats error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
            <div className="spinner" style={{ width: '40px', height: '40px' }} />
        </div>
    )

    const stats = [
        { label: 'Utilisateurs', value: data?.stats.totalUsers, icon: Users, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
        { label: 'Premium', value: data?.stats.premiumUsers, icon: Zap, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        { label: 'Scans', value: data?.stats.totalScans, icon: Camera, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        { label: 'Revenu Est.', value: '---', icon: TrendingUp, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
    ]

    const tabStyle = (id: string) => ({
        padding: '12px 24px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '800',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        background: activeTab === id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
        color: activeTab === id ? '#10b981' : 'rgba(255,255,255,0.4)',
        border: activeTab === id ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Nav Tabs */}
            <div style={{ 
                display: 'flex', 
                gap: '8px', 
                background: 'rgba(255,255,255,0.03)', 
                padding: '6px', 
                borderRadius: '16px', 
                width: 'fit-content',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div onClick={() => setActiveTab('general')} style={tabStyle('general')}><Activity size={16} /> Général</div>
                <div onClick={() => setActiveTab('users')} style={tabStyle('users')}><Users size={16} /> Utilisateurs</div>
                <div onClick={() => setActiveTab('payments')} style={tabStyle('payments')}><CreditCard size={16} /> Paiements</div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'general' && (
                    <motion.div 
                        key="general"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}
                    >
                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                            {stats.map((stat, i) => (
                                <div 
                                    key={stat.label}
                                    style={{ 
                                        padding: '32px', 
                                        borderRadius: '32px', 
                                        background: 'rgba(255,255,255,0.02)', 
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: '24px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                                            +12.5%
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.label}</p>
                                    <p style={{ fontSize: '36px', fontWeight: '900', color: '#fff', marginTop: '4px', letterSpacing: '-1px' }}>{stat.value?.toLocaleString() || '0'}</p>
                                </div>
                            ))}
                        </div>

                        {/* Recent Activity */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                            <CardWrapper title="Nouveaux inscrits" icon={<UserCheck size={20} color="#10b981" />}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {data?.latestUsers.slice(0, 5).map((u: any) => (
                                        <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', overflow: 'hidden' }}>
                                                {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.name?.charAt(0) || 'U'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '14px', fontWeight: '800' }}>{u.name || 'Utilisateur'}</p>
                                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '10px', fontWeight: '900', color: u.subscription_tier === 'premium' ? '#f59e0b' : '#666', textTransform: 'uppercase' }}>{u.subscription_tier}</span>
                                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{new Date(u.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardWrapper>

                            <CardWrapper title="Paiements récents" icon={<CreditCard size={20} color="#f59e0b" />}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {data?.recentPayments.slice(0, 5).map((p: any) => (
                                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                                                <CreditCard size={20} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '14px', fontWeight: '800' }}>{p.amount} {p.currency || 'XOF'}</p>
                                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>{p.provider || 'Maketou'}</p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '10px', fontWeight: '900', color: '#10b981' }}>RÉUSSI</span>
                                                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{new Date(p.created_at).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {data?.recentPayments.length === 0 && (
                                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '40px 0', fontSize: '14px' }}>Aucun paiement récent.</p>
                                    )}
                                </div>
                            </CardWrapper>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'users' && (
                    <motion.div 
                        key="users"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <CardWrapper title="Tous les utilisateurs" icon={<Users size={20} color="#3b82f6" />}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                            <th style={thStyle}>Utilisateur</th>
                                            <th style={thStyle}>Plan</th>
                                            <th style={thStyle}>Pays</th>
                                            <th style={thStyle}>Inscrit le</th>
                                            <th style={thStyle}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data?.latestUsers.map((u: any) => (
                                            <tr key={u.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>
                                                            {u.name?.charAt(0) || 'U'}
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: '13px', fontWeight: '700' }}>{u.name}</p>
                                                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: '10px', fontWeight: '900', color: u.subscription_tier === 'premium' ? '#f59e0b' : '#666', textTransform: 'uppercase' }}>{u.subscription_tier}</span>
                                                </td>
                                                <td style={tdStyle}><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{u.country || '---'}</span></td>
                                                <td style={tdStyle}><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>{new Date(u.created_at).toLocaleDateString()}</span></td>
                                                <td style={tdStyle}>
                                                    <button style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><MoreHorizontal size={18} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardWrapper>
                    </motion.div>
                )}

                {activeTab === 'payments' && (
                    <motion.div 
                        key="payments"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <CardWrapper title="Historique des transactions" icon={<CreditCard size={20} color="#f59e0b" />}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                            <th style={thStyle}>ID Transaction</th>
                                            <th style={thStyle}>Montant</th>
                                            <th style={thStyle}>Méthode</th>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data?.recentPayments.map((p: any) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={tdStyle}><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{p.id.substring(0, 8)}...</span></td>
                                                <td style={tdStyle}><span style={{ fontSize: '14px', fontWeight: '800' }}>{p.amount} {p.currency}</span></td>
                                                <td style={tdStyle}><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{p.provider}</span></td>
                                                <td style={tdStyle}><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>{new Date(p.created_at).toLocaleString()}</span></td>
                                                <td style={tdStyle}><span style={{ fontSize: '10px', fontWeight: '900', color: '#10b981' }}>SUCCESS</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {data?.recentPayments.length === 0 && (
                                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '60px 0', fontSize: '14px' }}>Aucune transaction trouvée.</p>
                                )}
                            </div>
                        </CardWrapper>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function CardWrapper({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid rgba(255,255,255,0.05)', 
            borderRadius: '32px', 
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {icon}
                <h3 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px' }}>{title}</h3>
            </div>
            {children}
        </div>
    )
}

const thStyle: React.CSSProperties = {
    padding: '16px',
    fontSize: '11px',
    fontWeight: '900',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '1.5px'
}

const tdStyle: React.CSSProperties = {
    padding: '16px',
    verticalAlign: 'middle'
}
