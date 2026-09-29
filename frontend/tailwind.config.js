/** @type {import('tailwindcss').Config} */
import defaultColors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/*
 * Theming: every palette used in the UI is backed by CSS variables, so a single
 * `.dark` class on <html> re-themes all existing utilities (including opacity
 * modifiers like bg-amber-50/60). Paper-like surfaces (.paper, #print-area)
 * re-declare the light palette so scanned documents and reports stay on white.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const custom = {
  brand: { 50: '#eef5fb', 100: '#d6e6f4', 200: '#adcbe7', 300: '#7eaad4', 400: '#4f86bd', 500: '#2f6aa5', 600: '#1e4e79', 700: '#193f63', 800: '#15334f', 900: '#10263b', 950: '#0a1a2a' },
  coal: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' },
}
const PALETTES = ['slate', 'emerald', 'amber', 'red', 'violet', 'sky', 'yellow', 'orange', 'teal', 'brand', 'coal']
const source = (name) => custom[name] || defaultColors[name]

// dark theme: pale tints become deep tints, dark text shades become light
const DARK_MAP = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 400, 500: 500, 600: 500, 700: 300, 800: 200, 900: 100, 950: 50 }
const SLATE_DARK = {
  50: '#0b1220', 100: '#172033', 200: '#243047', 300: '#344158', 400: '#6b7a93', 500: '#8f9db3',
  600: '#aab6c8', 700: '#c6cfdc', 800: '#dde3eb', 900: '#eef2f6', 950: '#f8fafc',
}
const BRAND_DARK = { ...Object.fromEntries(SHADES.map((s) => [s, custom.brand[DARK_MAP[s]]])), 500: '#4f86bd', 600: '#2f6aa5', 700: '#9cc0e3' }

const rgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}
function vars(mode) {
  const out = {}
  for (const name of PALETTES) {
    for (const s of SHADES) {
      let hex = source(name)[s]
      if (mode === 'dark') {
        if (name === 'slate') hex = SLATE_DARK[s]
        else if (name === 'brand') hex = BRAND_DARK[s]
        else hex = source(name)[DARK_MAP[s]]
      }
      out[`--c-${name}-${s}`] = rgb(hex)
    }
  }
  out['--surface'] = mode === 'dark' ? rgb('#111a2b') : rgb('#ffffff')
  return out
}

const colors = Object.fromEntries(PALETTES.map((name) => [name, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]))]))

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      colors: {
        ...colors,
        ink: { 950: '#07131f', 900: '#0b1f33', 800: '#12304d', 700: '#1a3d5f' },
      },
      backgroundColor: { white: 'rgb(var(--surface) / <alpha-value>)' },
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': vars('light'),
        '.dark': { ...vars('dark'), colorScheme: 'dark' },
        '.dark .paper, .dark #print-area, .light-scope': vars('light'),
      })
    }),
  ],
}
