'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, User, CreditCard, UserMinus, ShieldAlert, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ThemeSelector from '@/components/ThemeSelector'

export default function SettingsPage() {
    const router = useRouter()
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    const handleDeleteAccount = () => {
        alert("Demande de suppression enregistrée. Cela peut prendre jusqu'à 72h.")
        setShowDeleteModal(false)
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px', position: 'relative' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Paramètres</h1>
            </div>

            <div style={{ padding: '0 20px', marginTop: '10px' }}>
                {/* Section 1: Compte */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Mon Compte</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden', marginBottom: '28px' }}>
                    <button onClick={() => router.push('/settings/profile')} style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <User size={18} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>Informations personnelles</span>
                        </div>
                        <ChevronRight size={16} color="var(--text-muted)" />
                    </button>
                    <button onClick={() => router.push('/settings/subscription')} style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <CreditCard size={18} color="var(--text-secondary)" strokeWidth={1.5} />
                            <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>Gérer mon abonnement</span>
                        </div>
                        <ChevronRight size={16} color="var(--text-muted)" />
                    </button>
                </div>

                {/* Section 2: Préférences */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Préférences</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden', marginBottom: '28px' }}>
                    {/* ✅ REMPLACÉ: ThemeSelector à la place du bouton alert */}
                    <ThemeSelector />
                </div>

                {/* Section 3: Danger Zone */}
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', marginLeft: '4px' }}>Zone de danger</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden' }}>
                    <button onClick={() => setShowDeleteModal(true)} style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <UserMinus size={18} color="var(--danger)" strokeWidth={1.5} />
                        <span style={{ color: 'var(--danger)', fontSize: '15px', fontWeight: '600' }}>Supprimer mon compte</span>
                    </button>
                </div>
            </div>

            {/* Modal Delete */}
            <AnimatePresence>
                {showDeleteModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteModal(false)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                width: '100%', maxWidth: '340px', background: 'var(--bg-secondary)', borderRadius: '28px', padding: '32px 24px',
                                border: '0.5px solid var(--border-color)', textAlign: 'center', position: 'relative', zIndex: 3001,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <ShieldAlert size={28} color="var(--danger)" />
                            </div>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Êtes-vous sûr ?</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '28px' }}>Cette action est irréversible. Toutes vos données seront effacées.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={handleDeleteAccount} style={{ width: '100%', padding: '16px', background: 'var(--danger)', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '800', cursor: 'pointer' }}>
                                    Oui, supprimer
                                </button>
                                <button onClick={() => setShowDeleteModal(false)} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-muted)', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                                    Annuler
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}