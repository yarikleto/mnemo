import { useEffect, useState } from 'react'
import { unwrap } from '../lib/api'

type Pending = { version: string }

export function UpdateBanner() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    const off = window.api.onUpdateReady(info => setPending({ version: info.version }))
    return () => off()
  }, [])

  if (!pending) return null

  const restart = async () => {
    if (restarting) return
    setRestarting(true)
    try { await unwrap(window.api.restartToInstall()) } catch { setRestarting(false) }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/10 px-6 py-2.5 flex items-center gap-3 animate-slide-down"
    >
      <span className="text-[16px] leading-none" aria-hidden="true">⟳</span>
      <div className="flex-1 text-[12.5px] text-fg leading-snug">
        <span className="font-medium">Mnemo {pending.version} is ready.</span>
        <span className="text-muted ml-2">Restart to apply the update.</span>
      </div>
      <button
        onClick={restart}
        disabled={restarting}
        className="btn-primary !py-1 !px-3 !text-[12px]"
      >
        {restarting ? 'Restarting…' : 'Restart now'}
      </button>
      <button
        onClick={() => setPending(null)}
        className="btn-ghost !py-1 !px-2.5 !text-[12px]"
      >
        Later
      </button>
    </div>
  )
}
