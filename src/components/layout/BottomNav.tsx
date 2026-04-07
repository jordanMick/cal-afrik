'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function BottomNav() {
    const router = useRouter()
    const pathname = usePathname()

    const tabs = [
        {
            id: 'accueil',
            label: 'Accueil',
            path: '/dashboard',
            color: '#6366f1',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9Z"
                        fill="currentColor" />
                </svg>
            ),
        },
        {
            id: 'rapport',
            label: 'Rapport',
            path: '/journal',
            color: '#10b981',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 12H17M7 8H17M7 16H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            ),
        },
        {
            id: 'profil',
            label: 'Profil',
            path: '/profil',
            color: '#ec4899',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4 20C4 17.7909 7.58172 16 12 16C16.4183 16 20 17.7909 20 20"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            ),
        },
        {
            id: 'coach',
            label: 'Coach',
            path: '/coach',
            color: '#f59e0b',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            ),
        },
    ]

    return (
        <>
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: '#0d0d0d',
                borderTop: '0.5px solid #222',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'flex-end',
                padding: '10px 0 20px',
                zIndex: 999,
                maxWidth: '480px',
                margin: '0 auto',
            }}>

                {/* Tabs gauche : Accueil + Rapport */}
                {tabs.slice(0, 2).map((tab) => {
                    const isActive = pathname === tab.path
                    return (
                        <button
                            key={tab.id}
                            onClick={() => router.push(tab.path)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                minWidth: '72px',
                                padding: 0,
                            }}
                        >
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '12px',
                                background: isActive ? `rgba(${hexToRgbStr(tab.color)}, 0.15)` : 'transparent',
                                border: isActive ? `0.5px solid rgba(${hexToRgbStr(tab.color)}, 0.3)` : '0.5px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isActive ? tab.color : '#444',
                                transition: 'all 0.2s',
                            }}>
                                {tab.icon}
                            </div>
                            <span style={{
                                fontSize: '10px',
                                color: isActive ? tab.color : '#444',
                                fontWeight: isActive ? '500' : '400',
                                transition: 'color 0.2s',
                            }}>
                                {tab.label}
                            </span>
                        </button>
                    )
                })}

                {/* Scanner FAB central */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: '72px',
                    marginTop: '-20px',
                }}>
                    <button
                        onClick={() => router.push('/scanner')}
                        style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #10b981)',
                            border: '3px solid #0d0d0d',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
                            cursor: 'pointer',
                        }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M4 4H8M16 4H20M4 20H8M16 20H20M4 8V4H8M20 8V4H16M4 16V20H8M20 16V20H16"
                                stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                            <rect x="9" y="9" width="6" height="6" rx="1" fill="#fff" />
                        </svg>
                    </button>
                    <span style={{ fontSize: '10px', color: '#555' }}>Scanner</span>
                </div>

                {/* Tab droite : Profil */}
                {tabs.slice(2).map((tab) => {
                    const isActive = pathname === tab.path
                    return (
                        <button
                            key={tab.id}
                            onClick={() => router.push(tab.path)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                minWidth: '72px',
                                padding: 0,
                            }}
                        >
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '12px',
                                background: isActive ? `rgba(${hexToRgbStr(tab.color)}, 0.15)` : 'transparent',
                                border: isActive ? `0.5px solid rgba(${hexToRgbStr(tab.color)}, 0.3)` : '0.5px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isActive ? tab.color : '#444',
                                transition: 'all 0.2s',
                            }}>
                                {tab.icon}
                            </div>
                            <span style={{
                                fontSize: '10px',
                                color: isActive ? tab.color : '#444',
                                fontWeight: isActive ? '500' : '400',
                                transition: 'color 0.2s',
                            }}>
                                {tab.label}
                            </span>
                        </button>
                    )
                })}
            </div>

        </>
    )
}

function hexToRgbStr(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
}