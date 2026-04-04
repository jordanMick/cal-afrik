'use client'

import BottomNav from '@/components/layout/BottomNav'
import AuthProvider from '@/components/layout/AuthProvider'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

const navPaths = ['/dashboard', '/journal', '/scanner', '/profil']

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const currentIndex = navPaths.indexOf(pathname)

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
                <AnimatePresence mode="popLayout" initial={false} custom={currentIndex}>
                    <motion.div
                        key={pathname}
                        custom={currentIndex}
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 0 }}
                        transition={{
                            type: 'tween',
                            ease: [0.25, 0.46, 0.45, 0.94],
                            duration: 0.25,
                        }}
                        style={{ minHeight: '100vh' }}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </AuthProvider>

            <BottomNav />
        </div>
    )
}