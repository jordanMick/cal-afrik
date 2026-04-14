'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Info, CheckCircle, AlertCircle, ShoppingBag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        fetchNotifications()
    }, [])

    const fetchNotifications = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const res = await fetch('/api/notifications', {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
            const json = await res.json()
            if (json.success) setNotifications(json.data)
        } catch (err) {
            console.error('Fetch notifications error:', err)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (ids: string[]) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}` 
                },
                body: JSON.stringify({ ids })
            })
            setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
        } catch (err) {
            console.error('Mark as read error:', err)
        }
    }

    const unreadCount = notifications.filter(n => !n.read_at).length

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={18} color="var(--success)" />
            case 'warning': return <AlertCircle size={18} color="var(--warning)" />
            case 'meal': return <ShoppingBag size={18} color="var(--accent)" />
            default: return <Info size={18} color="var(--accent)" />
        }
    }

    return (
        <>
            <div 
                onClick={() => { setIsOpen(true); if (unreadCount > 0) markAsRead(notifications.filter(n => !n.read_at).map(n => n.id)) }} 
                style={{ 
                    width: '36px', height: '36px', borderRadius: '10px', 
                    background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', position: 'relative' 
                }}
            >
                <Bell color="var(--text-secondary)" size={20} strokeWidth={1.5} />
                {unreadCount > 0 && (
                    <span style={{ 
                        position: 'absolute', top: '-1px', right: '-1px', 
                        width: '14px', height: '14px', background: 'var(--danger)', 
                        borderRadius: '50%', border: '2px solid var(--bg-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '8px', fontWeight: '800'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '16px' }}>
                        {/* Overlay */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            style={{ 
                                width: '100%', maxWidth: '380px', background: 'var(--bg-secondary)', 
                                borderRadius: '24px', border: '0.5px solid var(--border-color)', 
                                padding: '24px', position: 'relative', zIndex: 10001,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                                maxHeight: '80vh', overflowY: 'auto'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>Notifications</h3>
                                <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {loading ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Chargement...</p>
                            ) : notifications.length === 0 ? (
                                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                                    <p style={{ fontSize: '32px', marginBottom: '10px' }}>📭</p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Aucune notification pour le moment.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => { if (n.link) router.push(n.link); setIsOpen(false) }}
                                            style={{ 
                                                padding: '16px', borderRadius: '16px', background: n.read_at ? 'transparent' : 'rgba(var(--accent-rgb), 0.05)',
                                                border: `0.5px solid ${n.read_at ? 'var(--border-color)' : 'rgba(var(--accent-rgb), 0.2)'}`,
                                                cursor: n.link ? 'pointer' : 'default'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{n.title}</p>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{n.message}</p>
                                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                                        {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                {!n.read_at && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', marginTop: '6px' }} />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
