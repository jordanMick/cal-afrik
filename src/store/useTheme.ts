import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'dark' | 'light' | 'auto'

interface ThemeStore {
    theme: ThemeMode
    setTheme: (theme: ThemeMode) => void
    isDarkMode: boolean
    setIsDarkMode: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set, get) => ({
            theme: 'dark',
            isDarkMode: true,

            setTheme: (theme: ThemeMode) => {
                set({ theme })

                // Si 'auto', détecte le thème du système
                if (theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                    set({ isDarkMode: prefersDark })
                    applyTheme(prefersDark)
                } else {
                    const isDark = theme === 'dark'
                    set({ isDarkMode: isDark })
                    applyTheme(isDark)
                }
            },

            setIsDarkMode: (isDark: boolean) => {
                set({ isDarkMode: isDark })
                applyTheme(isDark)
            }
        }),
        {
            name: 'theme-storage', // Clé dans localStorage
            partialize: (state) => ({ theme: state.theme, isDarkMode: state.isDarkMode })
        }
    )
)

function applyTheme(isDark: boolean) {
    const root = document.documentElement

    if (isDark) {
        root.style.colorScheme = 'dark'
        root.classList.add('dark')
        root.classList.remove('light')
    } else {
        root.style.colorScheme = 'light'
        root.classList.add('light')
        root.classList.remove('dark')
    }
}

// Initialiser le thème au chargement
export function initializeTheme() {
    const { theme, isDarkMode } = useThemeStore.getState()

    if (typeof window === 'undefined') return

    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(prefersDark)
    } else {
        applyTheme(isDarkMode)
    }
}