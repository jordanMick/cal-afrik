'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const navItems = [
    { path: '/dashboard', emoji: '🏠', label: 'Accueil' },
    { path: '/journal', emoji: '📋', label: 'Journal' },
    { path: '/scanner', emoji: '📷', label: 'Scanner' },
    { path: '/profil', emoji: '📊', label: 'Profil' },
]

export default function BottomNav() {
    const router = useRouter()
    const pathname = usePathname()
    const touchStartX = useRef<number | null>(null)
    const touchStartY = useRef<number | null>(null)

    const currentIndex = navItems.findIndex(item => item.path === pathname)

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            touchStartX.current = e.touches[0].clientX
            touchStartY.current = e.touches[0].clientY
        }

        const handleTouchEnd = (e: TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) return

            const deltaX = e.changedTouches[0].clientX - touchStartX.current
            const deltaY = e.changedTouches[0].clientY - touchStartY.current

            // Ignorer si c'est plus un scroll vertical qu'un swipe horizontal
            if (Math.abs(deltaY) > Math.abs(deltaX)) return

            // Seuil minimum de 60px pour déclencher la navigation
            if (Math.abs(deltaX) < 60) return

            if (deltaX < 0) {
                // Swipe gauche → page suivante
                const nextIndex = currentIndex + 1
                if (nextIndex < navItems.length) {
                    router.push(navItems[nextIndex].path)
                }
            } else {
                // Swipe droite → page précédente
                const prevIndex = currentIndex - 1
                if (prevIndex >= 0) {
                    router.push(navItems[prevIndex].path)
                }
            }

            touchStartX.current = null
            touchStartY.current = null
        }

        document.addEventListener('touchstart', handleTouchStart, { passive: true })
        document.addEventListener('touchend', handleTouchEnd, { passive: true })

        return () => {
            document.removeEventListener('touchstart', handleTouchStart)
            document.removeEventListener('touchend', handleTouchEnd)
        }
    }, [currentIndex, router])

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
                            // ✅ Fix clic lent sur mobile
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                        }}
                    >
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isActive ? 'rgba(196, 98, 45, 0.15)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: isActive ? '#C4622D' : '#888',
                            transition: 'all 0.2s ease',
                        }}>
                            {item.emoji}
                        </div>

                        <span style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            color: isActive ? '#C4622D' : '#444',
                        }}>
                            {item.label}
                        </span>

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