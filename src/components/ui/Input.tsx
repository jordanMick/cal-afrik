import React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  label?: string
  error?: string
  as?: 'input' | 'select'
}

export const Input = ({
  label,
  error,
  className,
  as = 'input',
  id,
  ...props
}: InputProps) => {
  const Component = as as any
  
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-zinc-500 px-1"
        >
          {label}
        </label>
      )}
      <Component
        id={id}
        className={cn(
          'w-full h-11 px-4 rounded-xl bg-zinc-900/50 border border-white/10 text-[14px] text-white',
          'placeholder:text-zinc-600 transition-all focus:outline-none focus:border-white/30 focus:bg-zinc-900',
          error && 'border-red-500/50 focus:border-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-[11px] text-red-500 px-1">{error}</p>
      )}
    </div>
  )
}
