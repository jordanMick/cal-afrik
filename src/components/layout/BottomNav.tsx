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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[432px] z-[999]">
      <div className="glass-panel h-20 rounded-[32px] grid grid-cols-4 items-center px-2 shadow-2xl shadow-black/80">
        
        {TABS.map((tab) => {
          const isActive = pathname === tab.path
          const isScanner = tab.id === 'scanner'
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className="relative flex flex-col items-center justify-center h-full gap-1 transition-all"
            >
              <div className={cn(
                "relative z-10 w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300",
                isScanner 
                   ? (isActive ? "bg-white text-black scale-110 shadow-lg shadow-white/10" : "bg-zinc-800 text-white hover:bg-zinc-700")
                   : (isActive ? "text-white" : "text-zinc-600 hover:text-zinc-400")
              )}>
                <Icon className={cn("w-5 h-5", isScanner && "w-6 h-6")} />
                
                {/* Petit indicateur sous l'icône active (hors scanner) */}
                {isActive && !isScanner && (
                  <motion.div 
                    layoutId="navIndicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-white"
                  />
                )}
              </div>
              
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-tighter transition-all duration-300",
                isActive ? "text-white opacity-100" : "text-zinc-600 opacity-60"
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
