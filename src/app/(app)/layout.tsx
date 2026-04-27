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
        <div className="mx-auto max-w-[480px] min-h-screen relative bg-[var(--bg-primary)] overflow-hidden flex flex-col">
            {/* Background Aura Blobs */}
            <div className="bg-blob" style={{ top: '-100px', right: '-150px', background: 'var(--success)', opacity: 0.08 }} />
            <div className="bg-blob" style={{ bottom: '100px', left: '-150px', background: 'var(--accent)', opacity: 0.08 }} />
            
            <AuthProvider>
                {/* ✅ Surveille les changements de créneau */}
                <SlotWatcherInit />

                <AnimatePresence mode="wait">
                    <motion.div
                        key={pathname}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
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
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    )
}
