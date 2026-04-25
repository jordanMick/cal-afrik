'use client'

import React from 'react'
import { Check, ArrowLeft, BrainCircuit } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { motion, AnimatePresence } from 'framer-motion'

interface MealRecapProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  isSaving: boolean
  selectedFoods: any[]
  totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  slotLabel: string
  slotColor: string
  recapRemainingAfter: number
  recapExceeded: boolean
  coachMessage: string
  isLoadingCoach: boolean
  onLoadCoach: () => void
  showCoach: boolean
}

export const MealRecap = ({
  isOpen,
  onClose,
  onSave,
  isSaving,
  selectedFoods,
  totals,
  slotLabel,
  slotColor,
  recapRemainingAfter,
  recapExceeded,
  coachMessage,
  isLoadingCoach,
  onLoadCoach,
  showCoach
}: MealRecapProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-zinc-950 rounded-t-[32px] border-t border-white/10 z-[101] overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-1 rounded-full bg-white/10 mt-3 mx-auto" />
            
            <div className="p-6 pt-10 overflow-y-auto max-h-[92vh] pb-32">
              <header className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Résumé du repas</h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    {selectedFoods.map(f => f.name).join(' · ')}
                  </p>
                </div>
                <Badge variant="accent" style={{ borderColor: `${slotColor}40`, color: slotColor }}>
                  {slotLabel}
                </Badge>
              </header>

              <div className="grid gap-6 mb-8">
                <Card className="bg-zinc-900/50 border-white/5 py-8 text-center">
                  <p className="text-5xl font-bold text-white tracking-tighter mb-2">
                    {Math.round(totals.calories)}
                  </p>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">calories totales</p>
                </Card>

                <Card className={`border ${recapExceeded ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-zinc-900/40'}`}>
                  <div className="flex justify-between items-center p-1">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Restant après repas</p>
                      <p className={`text-xl font-bold ${recapExceeded ? 'text-red-500' : 'text-white'}`}>
                        {recapExceeded ? `+${Math.abs(Math.round(recapRemainingAfter))}` : Math.round(recapRemainingAfter)} kcal
                      </p>
                    </div>
                    {recapExceeded && <Badge variant="error">Dépassement</Badge>}
                  </div>
                </Card>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Protéines', value: totals.protein_g, color: '#f59e0b', sub: 'g' },
                    { label: 'Glucides', value: totals.carbs_g, color: '#10b981', sub: 'g' },
                    { label: 'Lipides', value: totals.fat_g, color: '#2563eb', sub: 'g' },
                  ].map(m => (
                    <Card key={m.label} className="bg-zinc-900/40 border-white/5 py-4 text-center">
                      <p className="text-lg font-bold text-white" style={{ color: m.color }}>
                        {Math.round(m.value * 10) / 10}
                        <span className="text-[10px] ml-0.5 opacity-60 font-medium">g</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 font-medium">{m.label}</p>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                    variant={showCoach ? 'ghost' : 'outline'} 
                    fullWidth 
                    onClick={onLoadCoach}
                    className="h-14 border-zinc-800"
                >
                  <BrainCircuit className="w-4 h-4 mr-2 text-amber-500" />
                  {showCoach ? 'Conseil personnalisé de votre coach' : 'Demander l\'avis du coach →'}
                </Button>

                <AnimatePresence>
                  {showCoach && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10"
                    >
                      {isLoadingCoach ? (
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                          <p className="text-xs text-amber-600 font-medium">Rédaction en cours...</p>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-100/80 leading-relaxed italic">
                          "{coachMessage}"
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5">
              <div className="flex gap-4">
                <Button variant="secondary" onClick={onClose} className="flex-1">
                  Modifier
                </Button>
                <Button 
                    variant="primary" 
                    onClick={onSave} 
                    disabled={isSaving} 
                    className="flex-[2] text-white"
                    style={{ backgroundColor: slotColor }}
                >
                  {isSaving ? 'Enregistrement...' : '✅ Enregistrer'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
