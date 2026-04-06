import type { Metadata } from 'next'
import { DM_Sans, Syne } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
})

export const metadata: Metadata = {
  title: 'Cal Afrik',
  description: 'Suivez vos calories avec des plats africains',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${dmSans.variable} ${syne.variable} font-sans min-h-screen text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}