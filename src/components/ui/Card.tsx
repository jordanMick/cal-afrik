import React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean
  noPadding?: boolean
}

export const Card = ({ 
  children, 
  className, 
  glass = true, 
  noPadding = false,
  ...props 
}: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-300',
        glass ? 'glass-panel' : 'bg-card subtle-border',
        !noPadding && 'p-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
