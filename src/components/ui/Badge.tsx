import React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'accent'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  outline?: boolean
}

export const Badge = ({
  variant = 'neutral',
  outline = false,
  children,
  className,
  ...props
}: BadgeProps) => {
  const variants = {
    neutral: 'bg-zinc-800/50 text-zinc-400 border-zinc-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    accent: 'bg-white/10 text-white border-white/20',
  }

  return (
    <span
      className={cn(
        'px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
