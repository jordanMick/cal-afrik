'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeStore, type ThemeMode } from '@/store/useTheme'
import { Sun, Moon, Smartphone } from 'lucide-react'

interface ThemeSelectorProps {
    showModal?: boolean
    onClose?: () => void
}

export default function ThemeSelector({ showModal = false, onClose }: ThemeSelectorProps) {
    const { theme, setTheme, isDarkMode } = useThemeStore()
    const [isOpen, setIsOpen] = useState(showModal)

    const handleClose = () => {
        setIsOpen(false)
        onClose?.()
    }

    const handleSelectTheme = (selectedTheme: ThemeMode) => {
        setTheme(selectedTheme)
        handleClose()
    }

    const themeOptions: { id: ThemeMode; label: string; icon: React.ReactNode; description: string }[] = [
        {
            id: 'dark',
            label: 'Mode Sombre',
            icon: <Moon size={24} />,
            description: 'Parfait pour la nuit'
        },
        {
            id: 'light',
            label: 'Mode Clair',
            icon: <Sun size={24} />,
            description: 'Parfait pour le jour'
        },
        {
            id: 'auto',
            label: 'Automatique',
            icon: <Smartphone size={24} />,
            description: 'Suit les paramètres système'
        }
    ]

    return (
        <>
            {/* BOUTON RAPIDE (dans les paramètres) */}
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    width: '100%',
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Sun size={18} color="#ddd" strokeWidth={1.5} />
                    <span style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>Thème de l'application</span>
                </div>
                <span style={{ color: '#666', fontSize: '13px' }}>
                    {theme === 'dark' ? 'Sombre' : theme === 'light' ? 'Clair' : 'Automatique'}
                </span>
            </button>

            {/* MODAL */}
            <AnimatePresence>
                {isOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            style={{
                                width: '100%',
                                maxWidth: '340px',
                                background: '#141414',
                                borderRadius: '28px',
                                padding: '32px 24px',
                                border: '0.5px solid #222',
                                position: 'relative',
                                zIndex: 3001,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
                            }}
                        >
                            <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>Thème de l'application</h3>
                            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px', textAlign: 'center' }}>
                                Choisis le thème qui te convient le mieux
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                {themeOptions.map((option) => (
                                    <motion.button
                                        key={option.id}
                                        onClick={() => handleSelectTheme(option.id)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            padding: '16px',
                                            borderRadius: '16px',
                                            border: theme === option.id ? '1.5px solid #6366f1' : '0.5px solid #222',
                                            background: theme === option.id ? 'rgba(99,102,241,0.1)' : '#0a0a0a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '12px',
                                                background: theme === option.id ? 'rgba(99,102,241,0.2)' : '#1a1a1a',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: theme === option.id ? '#818cf8' : '#666',
                                                flexShrink: 0
                                            }}
                                        >
                                            {option.icon}
                                        </div>
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <p style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{option.label}</p>
                                            <p style={{ color: '#666', fontSize: '12px' }}>{option.description}</p>
                                        </div>
                                        {theme === option.id && (
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: '#6366f1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                ✓
                                            </div>
                                        )}
                                    </motion.button>
                                ))}
                            </div>

                            <button
                                onClick={handleClose}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'transparent',
                                    color: '#666',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    borderRadius: '12px'
                                }}
                            >
                                Fermer
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}