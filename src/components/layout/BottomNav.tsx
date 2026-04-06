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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[400px] z-[999] pointer-events-none">
      <div className="glass-panel h-20 rounded-[32px] grid grid-cols-4 items-center w-full px-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-t border-white/10 pointer-events-auto">
        
        {TABS.map((tab) => {
          const isActive = pathname === tab.path
          const isScanner = tab.id === 'scanner'
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className="relative flex flex-col items-center justify-center h-full group bg-transparent border-none p-0 outline-none appearance-none cursor-pointer"
            >
              {/* Effet Glow pour l'onglet actif */}
              {isActive && !isScanner && (
                <motion.div
                  layoutId="navGlow"
                  className="absolute inset-0 bg-white/5 blur-xl rounded-full pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              )}

              <div className={cn(
                "relative z-10 w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-500 ease-out",
                isScanner 
                   ? (isActive 
                       ? "bg-white text-black scale-110 shadow-[0_0_25px_rgba(255,255,255,0.3)]" 
                       : "bg-zinc-800 text-white hover:bg-zinc-700 shadow-lg")
                   : (isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")
              )}>
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="flex items-center justify-center"
                >
                  <Icon className={cn("w-5 h-5", isScanner && "w-6 h-6")} />
                </motion.div>
                
                {isActive && !isScanner && (
                  <motion.div 
                    layoutId="navIndicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                )}
              </div>
              
              <span className={cn(
                "text-[8px] font-black uppercase tracking-[0.1em] transition-all duration-300 mt-1",
                isActive ? "text-white opacity-100" : "text-zinc-600 opacity-60 group-hover:opacity-80"
              )}>
                {tab.label}
              </span>
            </button>
          )
        })}

      </div>
    </div>
  )
}
