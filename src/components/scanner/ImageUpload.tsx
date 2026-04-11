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
    <div className="relative w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!image ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => fileInputRef.current?.click()}
            className="group relative aspect-[3/4] w-full bg-zinc-950 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all overflow-hidden rounded-b-[3rem] border-b border-white/5"
          >
            {/* Effet de profondeur Cal AI */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent z-0" />
            
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110 group-hover:bg-white/10 z-10 border border-white/5 backdrop-blur-sm"
              style={{ backgroundColor: `${slotColor}15` }}
            >
              <Camera className="w-8 h-8" />
            </div>
            <div className="text-center z-10">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-white">Prendre une Photo</p>
                <p className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-widest">ANALYSE INSTANTANÉE</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative aspect-[3/4] w-full overflow-hidden rounded-b-[3.5rem] shadow-2xl"
          >
            <img src={image} alt="Meal preview" className="w-full h-full object-cover" />
            
            {/* Overlay Gradient pour lisibilité */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

            {!isAnalyzing && (
              <button
                onClick={onClear}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex flex-col items-center justify-center gap-6 overflow-hidden"
                >
                    {/* Laser Scan Animation */}
                    <motion.div 
                        initial={{ top: '0%' }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-[2px] bg-[#22c55e] shadow-[0_0_20px_#22c55e] z-30"
                    />
                    
                    <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-3 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">ANALYSE EN COURS...</span>
                    </div>
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
