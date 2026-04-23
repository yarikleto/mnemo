import { useEffect } from 'react'
import { useAppStore } from '../stores/app-store'

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
  return (
    <button onClick={() => setTheme(next)} className="text-xs text-muted hover:text-fg px-2 py-1 rounded border border-border">
      {label}
    </button>
  )
}
