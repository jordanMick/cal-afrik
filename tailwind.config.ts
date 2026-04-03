import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                earth: {
                    50: '#FAF0E6',
                    100: '#F5DFC8',
                    200: '#EFC09A',
                    400: '#E08048',
                    DEFAULT: '#C4622D',
                    600: '#A34E22',
                    800: '#7A3517',
                },
                forest: {
                    50: '#EBF5EE',
                    100: '#C8E8D1',
                    DEFAULT: '#2D6A4F',
                    600: '#1E5238',
                    800: '#133625',
                },
                gold: {
                    50: '#FEFAE6',
                    100: '#FDF3C0',
                    DEFAULT: '#E9C46A',
                    600: '#C9A045',
                    800: '#8A6A1E',
                },
            },
            fontFamily: {
                sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
                display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1.5rem',
                '4xl': '2rem',
            },
        },
    },
    plugins: [],
}
export default config