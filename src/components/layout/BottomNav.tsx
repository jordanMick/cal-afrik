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
  { id: 'accueil', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', path: '/journal', icon: ReceiptText },
  { id: 'profil', label: 'Profil', path: '/profil', icon: User },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="fixed bottom-6 left-0 right-0 max-w-[480px] mx-auto px-6 z-[999] pointer-events-none">
      <div className="glass-panel h-20 rounded-[28px] flex items-center justify-around px-4 pointer-events-auto shadow-2xl shadow-black/80">
        
        {/* Dashboard Link */}
        <NavItem 
          active={pathname === TABS[0].path} 
          onClick={() => router.push(TABS[0].path)}
          tab={TABS[0]}
        />

        {/* Journal Link */}
        <NavItem 
          active={pathname === TABS[1].path} 
          onClick={() => router.push(TABS[1].path)}
          tab={TABS[1]}
        />

        {/* Central Scanner FAB */}
        <div className="relative -mt-12">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push('/scanner')}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-black shadow-xl transition-all",
                pathname === '/scanner' 
                  ? "bg-white ring-4 ring-zinc-950" 
                  : "bg-white hover:bg-zinc-100 ring-4 ring-zinc-950"
              )}
            >
              <ScanLine className="w-7 h-7" />
            </motion.button>
            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Scan</span>
        </div>

        {/* Profile Link (using index 2) */}
        <NavItem 
          active={pathname === TABS[2].path} 
          onClick={() => router.push(TABS[2].path)}
          tab={TABS[2]}
        />
        
        {/* Placeholder for symmetry if needed, or we just use 3 tabs + 1 center */}
        <div className="w-14" /> 

      </div>
    </div>
  )
}

function NavItem({ active, onClick, tab }: { active: boolean, onClick: () => void, tab: any }) {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center w-14 h-full gap-1 transition-all"
    >
      <div className={cn(
        "transition-all duration-300",
        active ? "text-white scale-110" : "text-zinc-600 hover:text-zinc-400"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={cn(
        "text-[9px] font-bold uppercase tracking-widest transition-all",
        active ? "text-white opacity-100" : "text-zinc-600 opacity-0"
      )}>
        {tab.label}
      </span>
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute -bottom-1 w-1 h-1 rounded-full bg-white"
        />
      )}
    </button>
  )
}