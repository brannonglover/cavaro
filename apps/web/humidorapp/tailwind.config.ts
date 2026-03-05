import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        humidor: {
          bg: '#1a1512',
          card: '#252019',
          border: '#4a3c2e',
          primary: '#c4a574',
          'primary-light': '#d4b87a',
          cream: '#ebe4d8',
          muted: '#b8a99a',
          subtle: '#8b7d6e',
          like: '#5a8c4a',
          dislike: '#9a6b5c',
        },
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
