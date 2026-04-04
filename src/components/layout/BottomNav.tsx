'use client'

import { useRouter, usePathname } from 'next/navigation'

const navItems = [
    { path: '/dashboard', emoji: '🏠', label: 'Accueil' },
    { path: '/journal', emoji: '📋', label: 'Journal' },
    { path: '/scanner', emoji: '📷', label: 'Scanner' },
    { path: '/profil', emoji: '📊', label: 'Profil' },
]

export default function BottomNav() {
    const router = useRouter()
    const pathname = usePathname()

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '480px',
            height: '72px',
            background: '#1A1108',
            borderTop: '1px solid #2A1F14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 16px',
            zIndex: 100,
        }}>
            {navItems.map((item) => {
                const isActive = pathname === item.path

                return (
                    <button
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px 12px',
                        }}
                    >
                        {/* ICON */}
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isActive
                                ? 'rgba(196, 98, 45, 0.15)'
                                : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: isActive ? '#C4622D' : '#888',
                            transition: 'all 0.2s ease',
                        }}>
                            {item.emoji}
                        </div>

                        {/* LABEL */}
                        <span style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            color: isActive ? '#C4622D' : '#444',
                        }}>
                            {item.label}
                        </span>

                        {/* DOT ACTIVE */}
                        {isActive && (
                            <div style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#C4622D',
                            }} />
                        )}
                    </button>
                )
            })}
        </div>
    )

}