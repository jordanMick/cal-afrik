'use client'

import type { Metadata, Viewport } from 'next'
import { useEffect } from 'react'
import PWARegister from '@/components/PWARegister'
import { DM_Sans, Syne } from 'next/font/google'
import { initializeTheme } from '@/store/useTheme'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
})

// ⚠️ NOTE: Metadata et Viewport ne peuvent pas être utilisés avec 'use client'
// Solution: Créez un fichier metadata.ts séparé (voir ci-dessous)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ✅ Initialiser le thème au chargement
  useEffect(() => {
    initializeTheme()
  }, [])

  return (
    <html lang="fr">
      <head>
        {/* ✅ IMPORTANT: Ce script précharge le thème AVANT React ne se charge */}
        {/* Cela élimine le flash blanc au changement de thème */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme-storage');
                if (theme) {
                  const { state } = JSON.parse(theme);
                  const isDark = state?.theme === 'dark' ? true : state?.theme === 'light' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.classList.toggle('dark', isDark);
                  document.documentElement.classList.toggle('light', !isDark);
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${syne.variable} font-sans min-h-screen text-foreground antialiased`}>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}

