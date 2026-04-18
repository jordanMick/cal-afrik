'use client'

import { useEffect } from 'react'
import { initializeTheme } from '@/store/useTheme'

export default function ThemeInitializer() {
    useEffect(() => {
        initializeTheme()
    }, [])

    return null
}
