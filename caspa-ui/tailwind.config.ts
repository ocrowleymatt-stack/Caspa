import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f7f1e6',
        surface: '#fffaf0',
        accent: '#d4af37',
        muted: '#766b58',
        foreground: '#171a22',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      boxShadow: {
        room: '0 30px 100px rgba(75, 55, 21, 0.13)',
        paper: '0 18px 60px rgba(75, 55, 21, 0.10)',
      },
    },
  },
  plugins: [],
} satisfies Config;
