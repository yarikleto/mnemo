import { useEffect } from 'react'
import { useAppStore } from '../stores/app-store'

const SunIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.8 2.8l1.06 1.06M12.14 12.14l1.06 1.06M2.8 13.2l1.06-1.06M12.14 3.86l1.06-1.06" />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
    <path d="M6.5 2A6 6 0 0 0 8 14a6 6 0 0 0 5.83-4.62 5 5 0 0 1-7.21-7.21A6 6 0 0 0 6.5 2z" />
  </svg>
)

const SystemIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
    <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
    <path d="M5.5 14.5h5M8 11.5v3" />
  </svg>
)

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore()
  useEffect(() => {
    const apply = (t: string) => {
      const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => theme === 'system' && apply('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : SystemIcon
  return (
    <button
      onClick={() => setTheme(next)}
      className="btn-ghost !px-2 !py-2 shrink-0"
      title={`Theme: ${label} (click to switch)`}
      aria-label={`Theme: ${label}. Click to switch.`}
    >
      <Icon />
    </button>
  )
}
