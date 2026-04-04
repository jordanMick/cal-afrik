'use client'

import BottomNav from '@/components/layout/BottomNav'
import AuthProvider from '@/components/layout/AuthProvider'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const navPaths = ['/dashboard', '/journal', '/scanner', '/profil']

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const prevPathname = useRef(pathname)
    const [displayChildren, setDisplayChildren] = useState(children)
    const [transitionStyle, setTransitionStyle] = useState<React.CSSProperties>({})
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (pathname === prevPathname.current) {
            setDisplayChildren(children)
            return
        }

        const prevIndex = navPaths.indexOf(prevPathname.current)
        const nextIndex = navPaths.indexOf(pathname)

        // Si pas dans la nav (ex: onboarding), pas d'animation
        if (prevIndex === -1 || nextIndex === -1) {
            setDisplayChildren(children)
            prevPathname.current = pathname
            return
        }

        const direction = nextIndex > prevIndex ? 1 : -1
        setIsAnimating(true)

        // Nouvelle page entre par la droite ou la gauche
        setTransitionStyle({
            transform: `translateX(${direction * 100}%)`,
            transition: 'none',
        })

        setDisplayChildren(children)

        // Petit délai pour que le DOM se mette à jour avant l'animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTransitionStyle({
                    transform: 'translateX(0)',
                    transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                })

                setTimeout(() => {
                    setIsAnimating(false)
                    setTransitionStyle({})
                }, 300)
            })
        })

        prevPathname.current = pathname
    }, [pathname, children])

    return (
        <div style={{
            maxWidth: '480px',
            margin: '0 auto',
            minHeight: '100vh',
            position: 'relative',
            background: '#0a0603',
            overflow: 'hidden',
        }}>
            <AuthProvider>
                <div style={{
                    ...transitionStyle,
                    willChange: isAnimating ? 'transform' : 'auto',
                    minHeight: '100vh',
                }}>
                    {displayChildren}
                </div>
            </AuthProvider>

            <BottomNav />
        </div>
    )
}