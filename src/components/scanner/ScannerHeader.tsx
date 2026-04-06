import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { motion } from 'framer-motion'
import { Calendar, Flame } from 'lucide-react'

interface ScannerHeaderProps {
    slotLabel: string
    slotColor: string
    displayedRemaining: number
    displayedRemainingLabel: string
}

export const ScannerHeader = ({
    slotLabel,
    slotColor,
    displayedRemaining,
    displayedRemainingLabel
}: ScannerHeaderProps) => {
    return (
        <div className="space-y-6 py-4">
            {/* Calorie Focus - Style Cal AI */}
            <div className="text-center space-y-1">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center"
                >
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">
                        {displayedRemainingLabel}
                    </span>
                    <div className="relative">
                        <h1 className="text-7xl font-black tracking-tighter text-white tabular-nums">
                            {Math.round(displayedRemaining)}
                        </h1>
                        <div 
                            className="absolute -right-8 top-2 w-6 h-6 rounded-full flex items-center justify-center bg-white/5 border border-white/10"
                            style={{ color: slotColor }}
                        >
                            <Flame className="w-3 h-3 fill-current" />
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-white/40 mt-1">KCAL RESTANTES</span>
                </motion.div>
            </div>

            {/* Menu de créneaux style "Bottom Tabs" */}
            <div className="flex justify-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['Petit-déj', 'Déjeuner', 'Collation', 'Dîner'].map((label) => (
                    <button
                        key={label}
                        className={`px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                            label === slotLabel 
                            ? 'bg-[#ccff00] text-black shadow-lg shadow-[#ccff00]/20 scale-105' 
                            : 'bg-white/5 text-white/40 border border-white/5'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    )
}
