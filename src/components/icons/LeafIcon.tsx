import React from 'react'

export const LeafIcon = ({ size = 20, className = "", style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
        <defs>
            <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A3E635" />
                <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
        </defs>
        <path 
            d="M20 85C20 85 35 15 85 15C85 15 70 85 20 85Z" 
            fill="url(#leafGradient)" 
        />
        <path 
            d="M20 85L52 50" 
            stroke="white" 
            strokeWidth="3" 
            strokeOpacity="0.2"
            strokeLinecap="round" 
        />
    </svg>
)
