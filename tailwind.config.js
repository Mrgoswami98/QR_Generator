/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#07090f',
          900: '#0b0f17',
          850: '#111724',
          800: '#161d2d',
          700: '#1f2941',
          600: '#2b3752',
          500: '#3d4a68',
          400: '#67748f',
          300: '#97a2b8',
          200: '#c6cedb',
          100: '#e5e9f0',
          50: '#f5f7fa',
        },
        brand: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd1ff',
          300: '#8eb2ff',
          400: '#5a87ff',
          500: '#355ef7',
          600: '#213dec',
          700: '#1a2fd4',
          800: '#1b2aab',
          900: '#1c2b87',
        },
        accent: {
          400: '#2ee6a8',
          500: '#13cf92',
          600: '#07a874',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(10,15,30,.06), 0 8px 24px -12px rgba(10,15,30,.18)',
        lift: '0 2px 4px rgba(10,15,30,.07), 0 18px 40px -18px rgba(10,15,30,.35)',
      },
      borderRadius: { xl2: '14px' },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .28s cubic-bezier(.22,.8,.3,1) both',
      },
    },
  },
  plugins: [],
};
