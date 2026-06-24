import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

export function OnboardingRoute() {
  const navigate = useNavigate()
  const [defaultPath, setDefaultPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    unwrap(window.api.getDefaultVaultPath()).then(d => { if (alive) setDefaultPath(d.path) })
    return () => { alive = false }
  }, [])

  const commit = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const cfg = await unwrap(window.api.completeOnboarding())
      useAppStore.setState({ config: cfg })
      await useAppStore.getState().refreshNamespaces()
      navigate('/review', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const start = () => { if (defaultPath) commit() }

  return (
    <div className="h-full flex items-center justify-center px-8 animate-fade-in-up">
      <div className="max-w-[520px] text-center">
        <div className="eyebrow mb-4">Welcome</div>
        <h1 className="font-editorial text-[34px] font-semibold leading-tight tracking-[-0.015em] mb-5">
          Welcome to Mnemo.
        </h1>
        <p className="text-[14.5px] leading-relaxed text-muted mb-9">
          Mnemo stores your cards as plain markdown files in its app data folder. You can open
          that folder from the menu, edit cards in any editor, and share them as a single zip.
        </p>

        <div className="flex flex-col items-stretch gap-2.5 mb-6">
          <button
            onClick={start}
            disabled={busy || !defaultPath}
            className="btn-primary py-3 text-[14px] flex flex-col items-center gap-0.5"
          >
            <span>Start using Mnemo</span>
            {defaultPath && (
              <span className="font-mono text-[11px] font-normal opacity-80">{defaultPath}</span>
            )}
          </button>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="chip-error mx-auto inline-flex animate-pop-in">{error}</div>
        )}
        {busy && (
          <div role="status" aria-live="polite" className="text-[12px] text-muted italic animate-pulse-soft">Setting up…</div>
        )}
      </div>
    </div>
  )
}
