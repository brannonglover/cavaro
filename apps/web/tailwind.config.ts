import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        cigar: {
          50: '#faf7f4',
          100: '#f3ebe3',
          200: '#e6d5c4',
          300: '#d4b99a',
          400: '#c19a6f',
          500: '#b38252',
          600: '#a66d44',
          700: '#8a5739',
          800: '#6f4732',
          900: '#5b3c2b',
          950: '#311e14',
        },
        humidor: {
          bg: '#1a1512',
          card: '#252019',
          primary: '#c4a574',
          'primary-light': '#d4b88a',
          cream: '#ebe4d8',
          muted: '#b8a99a',
          subtle: '#8a7d72',
          border: '#3d352d',
          like: '#7cb342',
        },
      },
    },
  },
  plugins: [],
}
export default config
