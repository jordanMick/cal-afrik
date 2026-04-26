import React from 'react'

export const AppLogo = ({ size = 80 }: { size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
    >
        <defs>
            <linearGradient id="leafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A3E635" />
                <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
            <linearGradient id="leafGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#86EFAC" />
                <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
            <linearGradient id="scannerCornerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#4ADE80" />
            </linearGradient>
        </defs>

        {/* Scanner corner — top left (white) */}
        <path d="M30 70 L30 35 Q30 28 37 28 L70 28" stroke="white" strokeWidth="9" strokeLinecap="round" fill="none" />
        {/* Scanner corner — top right (green) */}
        <path d="M170 70 L170 35 Q170 28 163 28 L130 28" stroke="#4ADE80" strokeWidth="9" strokeLinecap="round" fill="none" />
        {/* Scanner corner — bottom left (white) */}
        <path d="M30 135 L30 168 Q30 175 37 175 L70 175" stroke="white" strokeWidth="9" strokeLinecap="round" fill="none" />
        {/* Scanner corner — bottom right (green) */}
        <path d="M170 135 L170 168 Q170 175 163 175 L130 175" stroke="#4ADE80" strokeWidth="9" strokeLinecap="round" fill="none" />

        {/* Grande feuille gauche */}
        <path
            d="M90 108 C90 108 55 95 52 55 C52 55 92 58 95 95 Z"
            fill="url(#leafGrad1)"
        />
        {/* Nervure grande feuille */}
        <path d="M52 55 L90 105" stroke="#166534" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />

        {/* Petite feuille droite */}
        <path
            d="M105 108 C105 108 130 90 138 55 C138 55 105 65 102 100 Z"
            fill="url(#leafGrad2)"
        />
        {/* Nervure petite feuille */}
        <path d="M138 55 L105 105" stroke="#166534" strokeWidth="1.5" strokeOpacity="0.35" strokeLinecap="round" />

        {/* Mortier — corps (bol) */}
        <path
            d="M62 115 Q60 145 100 148 Q140 145 138 115 Z"
            fill="white"
            fillOpacity="0.92"
        />
        {/* Mortier — rebord supérieur */}
        <rect x="58" y="110" width="84" height="10" rx="5" fill="white" fillOpacity="0.95" />
        {/* Mortier — base / pied */}
        <rect x="82" y="148" width="36" height="8" rx="4" fill="white" fillOpacity="0.85" />
        {/* Ombre intérieure du mortier */}
        <path
            d="M70 120 Q69 140 100 143 Q131 140 130 120"
            stroke="#000"
            strokeWidth="2"
            strokeOpacity="0.1"
            fill="none"
        />
    </svg>
)
