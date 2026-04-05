'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'

const navItems = [
    { path: '/dashboard', emoji: '🏠', label: 'Accueil' },
    { path: '/journal', emoji: '📋', label: 'Rapport' },
    { path: '/scanner', emoji: '📷', label: 'Scanner' },
    { path: '/profil', emoji: '👤', label: 'Profil' },
]

export default function BottomNav() {
    const router = useRouter()
    const pathname = usePathname()
    const touchStartX = useRef<number | null>(null)
    const touchStartY = useRef<number | null>(null)
    const { bilanSeenDate } = useAppStore()

    const currentIndex = navItems.findIndex(item => item.path === pathname)
    const today = new Date().toISOString().split('T')[0]
    const hour = new Date().getHours()
    const showBilanBadge = hour >= 22 && bilanSeenDate !== today

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            touchStartX.current = e.touches[0].clientX
            touchStartY.current = e.touches[0].clientY
        }

        const handleTouchEnd = (e: TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) return

            const deltaX = e.changedTouches[0].clientX - touchStartX.current
            const deltaY = e.changedTouches[0].clientY - touchStartY.current

            if (Math.abs(deltaY) > Math.abs(deltaX)) return
            if (Math.abs(deltaX) < 60) return

            const target = e.target as HTMLElement
            const scrollableParent = target.closest('[data-swipe-ignore]') ||
                target.closest('input') || target.closest('select') ||
                (() => {
                    let el: HTMLElement | null = target
                    while (el) {
                        const style = window.getComputedStyle(el)
                        const overflowX = style.overflowX
                        if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return el
                        el = el.parentElement
                    }
                    return null
                })()

            if (scrollableParent) return

            if (deltaX < 0) {
                const nextIndex = currentIndex + 1
                if (nextIndex < navItems.length) router.push(navItems[nextIndex].path)
            } else {
                const prevIndex = currentIndex - 1
                if (prevIndex >= 0) router.push(navItems[prevIndex].path)
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
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px', height: '72px',
            background: '#1A1108', borderTop: '1px solid #2A1F14',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            padding: '0 16px', zIndex: 100,
        }}>
            {navItems.map((item) => {
                const isActive = pathname === item.path
                const isProfilItem = item.path === '/profil'

                return (
                    <button
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            gap: '4px', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '8px 12px',
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                            position: 'relative',
                        }}
                    >
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: isActive ? 'rgba(196, 98, 45, 0.15)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px', color: isActive ? '#C4622D' : '#888',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                        }}>
                            {item.emoji}

                            {/* ✅ Badge bilan non lu */}
                            {isProfilItem && showBilanBadge && (
                                <div style={{
                                    position: 'absolute', top: '0px', right: '0px',
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: '#E24B4A', border: '1.5px solid #1A1108',
                                }} />
                            )}
                        </div>

                        <span style={{ fontSize: '10px', fontWeight: '600', color: isActive ? '#C4622D' : '#444' }}>
                            {item.label}
                        </span>

                        {isActive && (
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#C4622D' }} />
                        )}
                    </button>
                )
            })}
        </div>
    )
}