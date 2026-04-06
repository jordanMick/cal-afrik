'use client'

import React from 'react'
import { Camera, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageUploadProps {
  image: string | null
  onImageChange: (file: File) => void
  onClear: () => void
  isAnalyzing: boolean
  slotColor: string
}

export const ImageUpload = ({
  image,
  onImageChange,
  onClear,
  isAnalyzing,
  slotColor
}: ImageUploadProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="relative mb-6">
      <AnimatePresence mode="wait">
        {!image ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-48 rounded-2xl border-2 border-dashed border-white/10 bg-zinc-900/40 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-zinc-900/60 hover:border-white/20 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/60 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${slotColor}1a` }}
            >
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-zinc-500">Ajouter une photo du repas</p>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-video rounded-2xl overflow-hidden border border-white/10"
          >
            <img src={image} alt="Meal preview" className="w-full h-full object-cover" />
            {!isAnalyzing && (
              <button
                onClick={onClear}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-transform hover:scale-110"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                >
                  <div className="relative w-12 h-12">
                     <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                     <motion.div 
                       animate={{ rotate: 360 }}
                       transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                       className="absolute inset-0 border-2 border-transparent border-t-white rounded-full"
                     />
                  </div>
                  <p className="text-white font-medium text-sm">Analyse de l'IA...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImageChange(file)
        }}
        className="hidden"
      />
    </div>
  )
}
