'use client'

import React from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { motion, AnimatePresence } from 'framer-motion'
import { EnrichedSuggestion } from '@/types'

interface AnalysisResultsProps {
  mealName: string
  totalCalories: number
  suggestions: EnrichedSuggestion[]
  selectedFoods: EnrichedSuggestion[]
  onSelect: (food: EnrichedSuggestion) => void
  slotColor: string
}

export const AnalysisResults = ({
  mealName,
  totalCalories,
  suggestions,
  selectedFoods,
  onSelect,
  slotColor
}: AnalysisResultsProps) => {
  if (suggestions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-bold text-white">{mealName || 'Repas détecté'}</h2>
          {totalCalories > 0 && (
            <p className="text-xs text-zinc-500 font-medium">~{totalCalories} kcal estimés par l'IA</p>
          )}
        </div>
        <Badge variant="accent" className="bg-zinc-800/80">
          <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
          Analyse IA
        </Badge>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-1">
          Aliments détectés
        </p>
        <div className="grid gap-3">
          {suggestions.map((food) => {
            const isSelected = !!selectedFoods.find(f => f.id === food.id)
            return (
              <motion.div
                key={food.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(food)}
              >
                <Card
                  className={`cursor-pointer transition-all border ${
                    isSelected 
                      ? 'border-white/20 bg-white/5 ring-1 ring-white/10' 
                      : 'border-white/5 bg-zinc-900/40 hover:border-white/10'
                  }`}
                  noPadding
                >
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white truncate">{food.name}</p>
                        {food.fromAI && <Badge variant="warning" className="text-[9px] py-0 px-1.5 opacity-80">IA</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-medium">
                        <span>{food.portion_g}g</span>
                        <div className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span style={{ color: isSelected ? slotColor : undefined }}>{food.calories} kcal</span>
                      </div>
                    </div>
                    
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-white border-white scale-110 shadow-lg' 
                        : 'border-white/10 bg-black/20'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
