'use client'

import React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion, HTMLMotionProps } from 'framer-motion'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  children?: React.ReactNode
  fullWidth?: boolean
}

export const Button = ({
  variant = 'primary',
  children,
  className,
  fullWidth = false,
  ...props
}: ButtonProps) => {
  const variants = {
    primary: 'bg-white text-black hover:bg-zinc-200 font-semibold',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
    ghost: 'bg-transparent text-white hover:bg-white/10',
    outline: 'bg-transparent text-white border border-white/20 hover:border-white/40 hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'h-14 px-8 rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none text-sm font-bold tracking-tight',
        fullWidth && 'w-full',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
