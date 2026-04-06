import React from 'react'
import { Card } from '@/components/ui/Card'

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
    <div className="space-y-4 mb-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Scanner</h1>
      <Card className="relative overflow-hidden border-white/5 bg-zinc-900/40" noPadding>
        <div 
          className="absolute top-0 left-0 right-0 h-1" 
          style={{ backgroundColor: slotColor }} 
        />
        <div className="p-4 flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Créneau actuel</p>
            <p className="text-sm font-medium text-white">{slotLabel}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{displayedRemainingLabel}</p>
            <p 
              className="text-sm font-bold" 
              style={{ color: displayedRemaining <= 0 ? '#ef4444' : slotColor }}
            >
              {displayedRemaining} kcal
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
