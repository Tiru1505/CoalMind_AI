/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      colors: {
        ink: { 950: '#07131f', 900: '#0b1f33', 800: '#12304d', 700: '#1a3d5f' },
        brand: {
          50: '#eef5fb', 100: '#d6e6f4', 200: '#adcbe7', 300: '#7eaad4', 400: '#4f86bd',
          500: '#2f6aa5', 600: '#1e4e79', 700: '#193f63', 800: '#15334f', 900: '#10263b',
        },
        coal: { 50: '#fffbeb', 100: '#fef3c7', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 38, 59, 0.06), 0 1px 1px rgba(16, 38, 59, 0.04)',
        pop: '0 10px 30px -10px rgba(16, 38, 59, 0.25), 0 4px 10px -4px rgba(16, 38, 59, 0.1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(47,106,165,.45)' }, '100%': { boxShadow: '0 0 0 10px rgba(47,106,165,0)' } },
        flash: { '0%,100%': { backgroundColor: 'transparent' }, '30%': { backgroundColor: 'rgba(250, 204, 21, .45)' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'slide-in': 'slide-in .25s ease-out both',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
        flash: 'flash 1.6s ease-in-out 2',
      },
    },
  },
  plugins: [],
}
