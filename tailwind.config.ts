import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Charter', 'Georgia', 'Cambria', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)'
      }
    }
  }
} satisfies Config
