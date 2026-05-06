import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        serif: ['Lora', '"Iowan Old Style"', 'Georgia', 'Cambria', 'serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        sidebar: 'rgb(var(--sidebar) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)'
      },
      keyframes: {
        'fade-in':      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up':   { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in-down': { '0%': { opacity: '0', transform: 'translateY(-6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pop-in':       { '0%': { opacity: '0', transform: 'scale(0.96) translateY(6px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        'pop-soft':     { '0%': { opacity: '0', transform: 'scale(0.6)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-down':   { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft':   { '0%, 100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        'shimmer':      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'progress-glow':{ '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--accent) / 0)' }, '50%': { boxShadow: '0 0 12px 0 rgb(var(--accent) / 0.55)' } }
      },
      animation: {
        'fade-in':      'fade-in 220ms ease-out both',
        'fade-in-up':   'fade-in-up 360ms cubic-bezier(0.2,0.8,0.2,1) both',
        'fade-in-down': 'fade-in-down 240ms ease-out both',
        'pop-in':       'pop-in 240ms cubic-bezier(0.2,0.8,0.2,1) both',
        'pop-soft':     'pop-soft 360ms cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-down':   'slide-down 260ms cubic-bezier(0.2,0.8,0.2,1) both',
        'pulse-soft':   'pulse-soft 1.6s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'progress-glow':'progress-glow 1.6s ease-in-out infinite'
      }
    }
  }
} satisfies Config
