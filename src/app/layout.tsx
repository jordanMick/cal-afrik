import type { Metadata, Viewport } from 'next'
import PWARegister from '@/components/PWARegister'
import ThemeInitializer from '@/components/ThemeInitializer'
import { DM_Sans, Syne } from 'next/font/google'
import { metadata as siteMetadata, viewport as siteViewport } from './Metadata'
import { Toaster } from 'sonner'
import './globals.css'
import Script from 'next/script'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
})

export const metadata: Metadata = siteMetadata
export const viewport: Viewport = siteViewport

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* ✅ IMPORTANT: Ce script précharge le thème AVANT que React ne se charge */}
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
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "wdra4bg6ai");
  `}
        </Script>

      </head>
      <body className={`${dmSans.variable} ${syne.variable} font-sans min-h-screen text-foreground antialiased`}>
        <Toaster position="top-center" richColors expand={true} />
        <ThemeInitializer />
        <PWARegister />
        {children}
      </body>
    </html>
  )
}

