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
    Activity
} from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

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
        <div className="flex items-center justify-center h-96">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </div>
    )

    const stats = [
        { label: 'Utilisateurs Totaux', value: data?.stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Abonnés Premium', value: data?.stats.premiumUsers, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Scans Réalisés', value: data?.stats.totalScans, icon: Camera, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Paiements (Récents)', value: data?.recentPayments.length, icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    ]

    return (
        <div className="space-y-10 pb-20">
            {/* Header section with Welcome */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white">Tableau de bord</h2>
                    <p className="text-gray-400 mt-2">Vue d'ensemble de l'activité de Cal-Afrik.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button className="h-12 px-6 rounded-xl bg-white/5 border border-white/10 text-sm font-bold flex items-center gap-2 hover:bg-white/10 transition-all">
                        <Filter size={16} /> Filtrer
                    </button>
                    <button className="h-12 px-6 rounded-xl bg-emerald-500 text-black text-sm font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                        Exporter les données
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <div className="text-emerald-500 text-xs font-black bg-emerald-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
                                <ArrowUpRight size={12} /> +12%
                            </div>
                        </div>
                        <p className="text-gray-400 font-bold text-sm">{stat.label}</p>
                        <p className="text-3xl font-black text-white mt-1">{stat.value?.toLocaleString()}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Derniers utilisateurs */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                            <Activity className="text-emerald-500" /> Nouveaux Utilisateurs
                        </h3>
                        <button className="text-sm font-bold text-emerald-500">Voir tout</button>
                    </div>

                    <div className="rounded-3xl overflow-hidden border border-white/5 bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/5">
                                    <th className="px-6 py-4 text-xs font-black uppercase text-gray-500 tracking-widest">Utilisateur</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-gray-500 tracking-widest">Plan</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase text-gray-500 tracking-widest">Date d'inscription</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.latestUsers.map((u: any) => (
                                    <tr key={u.email} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-all group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center font-black overflow-hidden border border-white/10 shadow-lg shadow-emerald-500/10">
                                                    {u.avatar_url ? (
                                                        <img src={u.avatar_url} className="w-full h-full object-cover" />
                                                    ) : u.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">{u.name || 'Sans nom'}</p>
                                                    <p className="text-gray-500 text-xs">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                u.subscription_tier === 'premium' ? 'bg-amber-500/10 text-amber-500' : 
                                                u.subscription_tier === 'pro' ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-500'
                                            }`}>
                                                {u.subscription_tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400 font-medium">
                                            {new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 rounded-xl hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal size={18} className="text-gray-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Flux financier (Recent Payments) */}
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <CreditCard className="text-amber-500" /> Flux de Paiements
                    </h3>

                    <div className="space-y-4">
                        {data?.recentPayments.map((p: any) => (
                            <div key={p.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                        <ArrowUpRight size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">{p.amount} {p.currency || 'XOF'}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{p.provider || 'Maketou'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-emerald-500 mb-1">SUCCÈS</p>
                                    <p className="text-[10px] text-gray-600 font-medium">{new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                        ))}

                        {data?.recentPayments.length === 0 && (
                            <div className="p-10 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                                <p className="text-gray-500 text-sm font-bold">Aucun paiement récent.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
