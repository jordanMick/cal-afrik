'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, ReceiptText, User, ScanLine } from 'lucide-react'
import { motion } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TABS = [
  { id: 'accueil', label: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', path: '/journal', icon: ReceiptText },
  { id: 'scanner', label: 'Scan', path: '/scanner', icon: ScanLine },
  { id: 'profil', label: 'Me', path: '/profil', icon: User },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[360px] z-[999] pointer-events-none">
      <div className="glass-panel h-16 rounded-full grid grid-cols-4 items-center w-full px-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/5 pointer-events-auto">
        
        {TABS.map((tab) => {
          const isActive = pathname === tab.path
          const isScanner = tab.id === 'scanner'
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className="relative flex items-center justify-center h-full group bg-transparent border-none p-0 outline-none appearance-none cursor-pointer"
            >
              <div className={cn(
                "relative z-10 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-500 ease-out",
                isScanner 
                   ? (isActive 
                       ? "bg-white text-black scale-110 shadow-[0_0_30px_rgba(255,255,255,0.4)]" 
                       : "bg-zinc-900 text-white hover:bg-zinc-800")
                   : (isActive ? "text-white" : "text-white/20 group-hover:text-white/50")
              )}>
                <motion.div
                  whileTap={{ scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="flex items-center justify-center text-inherit"
                >
                  <Icon className={cn("w-5 h-5", isScanner && "w-6 h-6")} />
                </motion.div>
                
                {isActive && !isScanner && (
                  <motion.div 
                    layoutId="navIndicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)]"
                  />
                )}
              </div>
            </button>
          )
        })}

      </div>
    </div>
  )
}
