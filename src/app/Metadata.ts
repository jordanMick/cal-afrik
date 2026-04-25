import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
    title: 'Cal Afrik',
    description: 'Suivez vos calories avec des plats africains',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Cal Afrik',
    },
}

export const viewport: Viewport = {
    themeColor: '#16a34a',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}
