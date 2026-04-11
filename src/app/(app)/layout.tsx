'use client'

import BottomNav from '@/components/layout/BottomNav'
import AuthProvider from '@/components/layout/AuthProvider'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useSlotWatcher } from '@/hooks/useSlotWatcher'

const navPaths = ['/dashboard', '/journal', '/scanner', '/coach', '/profil']

function SlotWatcherInit() {
    useSlotWatcher()
    return null
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const currentIndex = navPaths.indexOf(pathname)

    return (
        <div className="mx-auto max-w-[480px] min-h-screen relative bg-zinc-950 overflow-hidden flex flex-col">
            <AuthProvider>
                {/* ✅ Surveille les changements de créneau */}
                <SlotWatcherInit />

                <AnimatePresence mode="popLayout" initial={false} custom={currentIndex}>
                    <motion.div
                        key={pathname}
                        custom={currentIndex}
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 0 }}
                        transition={{ type: 'tween', ease: [0.25, 0.46, 0.45, 0.94], duration: 0.25 }}
                        className="flex-1"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </AuthProvider>

            <BottomNav />
            {/* ✅ Dégradés SVG globaux (Fix pour les bugs d'affichage sur iPhone/Safari lors de la navigation) */}
            <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
                <defs>
                    <linearGradient id="globalDashboardArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    )
}