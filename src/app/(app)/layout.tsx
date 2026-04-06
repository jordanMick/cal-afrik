'use client'

import BottomNav from '@/components/layout/BottomNav'
import AuthProvider from '@/components/layout/AuthProvider'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useSlotWatcher } from '@/hooks/useSlotWatcher'

const navPaths = ['/dashboard', '/journal', '/scanner', '/profil']

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
        </div>
    )
}