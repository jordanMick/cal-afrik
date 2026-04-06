'use client'

import React from 'react'
import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { motion, AnimatePresence } from 'framer-motion'

const CATEGORIES = [
  { value: 'cereales', label: '🌾 Céréales' },
  { value: 'tubercules', label: '🥔 Tubercules' },
  { value: 'legumineuses', label: '🫘 Légumineuses' },
  { value: 'viandes', label: '🥩 Viandes' },
  { value: 'poissons', label: '🐟 Poissons' },
  { value: 'legumes', label: '🥦 Légumes' },
  { value: 'sauces', label: '🍲 Sauces' },
  { value: 'boissons', label: '🥤 Boissons' },
  { value: 'snacks', label: '🍿 Snacks' },
  { value: 'plats_composes', label: '🍽️ Plats composés' },
]

interface ManualFood {
  name_fr: string
  portion_g: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  category: string
}

interface ManualFoodFormProps {
  isOpen: boolean
  onToggle: () => void
  manualFood: ManualFood
  setManualFood: React.Dispatch<React.SetStateAction<ManualFood>>
  onSave: () => void
  isSaving: boolean
  slotColor: string
}

export const ManualFoodForm = ({
  isOpen,
  onToggle,
  manualFood,
  setManualFood,
  onSave,
  isSaving,
  slotColor
}: ManualFoodFormProps) => {
  return (
    <div className="space-y-4">
      <Button 
        variant="ghost" 
        fullWidth 
        onClick={onToggle}
        className="border border-dashed border-white/10 text-zinc-500 h-14 rounded-2xl hover:bg-white/5"
      >
        <Plus className="w-4 h-4 mr-2" />
        {isOpen ? 'Fermer le formulaire' : 'Ajouter manuellement'}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-zinc-900/40 border-white/5 space-y-6 p-5">
              <div className="space-y-4">
                <Input
                  label="Nom de l'aliment"
                  placeholder="ex: Rôti de porc"
                  value={manualFood.name_fr}
                  onChange={e => setManualFood(p => ({ ...p, name_fr: e.target.value }))}
                />
                <Input
                  as="select"
                  label="Catégorie"
                  value={manualFood.category}
                  onChange={e => setManualFood(p => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value} className="bg-zinc-900">{c.label}</option>
                  ))}
                </Input>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Portion (g)"
                    value={manualFood.portion_g}
                    onChange={e => setManualFood(p => ({ ...p, portion_g: Number(e.target.value) }))}
                  />
                  <Input
                    type="number"
                    label="Calories (kcal)"
                    value={manualFood.calories}
                    onChange={e => setManualFood(p => ({ ...p, calories: Number(e.target.value) }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Input
                    type="number"
                    label="Proteines"
                    placeholder="0"
                    value={manualFood.protein_g}
                    onChange={e => setManualFood(p => ({ ...p, protein_g: Number(e.target.value) }))}
                  />
                  <Input
                    type="number"
                    label="Glucides"
                    placeholder="0"
                    value={manualFood.carbs_g}
                    onChange={e => setManualFood(p => ({ ...p, carbs_g: Number(e.target.value) }))}
                  />
                  <Input
                    type="number"
                    label="Lipides"
                    placeholder="0"
                    value={manualFood.fat_g}
                    onChange={e => setManualFood(p => ({ ...p, fat_g: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <Button
                fullWidth
                disabled={isSaving || !manualFood.name_fr || manualFood.calories <= 0}
                onClick={onSave}
                style={{ backgroundColor: slotColor }}
                className="text-white hover:opacity-90"
              >
                {isSaving ? 'Enregistrement...' : '✅ Enregistrer et ajouter'}
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
