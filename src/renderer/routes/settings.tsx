import { useEffect, useState } from 'react'
import { WIDGET_IDS, type WidgetId } from '../../shared/constants'
import type { Config } from '../../shared/schema'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'

export function SettingsRoute() {
  const { config } = useAppStore()
  const [local, setLocal] = useState<Config | null>(config)
  useEffect(() => { setLocal(config) }, [config])
  if (!local) return <div className="p-6 text-muted">Loading…</div>

  const toggle = async (id: WidgetId) => {
    const widgets = local.dashboard.widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w)
    const next = await unwrap(window.api.updateConfig({ dashboard: { widgets } }))
    setLocal(next); useAppStore.setState({ config: next })
  }
  const move = async (id: WidgetId, dir: -1 | 1) => {
    const ws = [...local.dashboard.widgets].sort((a, b) => a.order - b.order)
    const idx = ws.findIndex(w => w.id === id)
    if (idx < 0) return
    const swap = idx + dir
    if (swap < 0 || swap >= ws.length) return
    const next = ws.map((w, i) => ({ ...w, order: i })).map((w, i) => {
      if (i === idx) return { ...w, order: swap }
      if (i === swap) return { ...w, order: idx }
      return w
    })
    const cfg = await unwrap(window.api.updateConfig({ dashboard: { widgets: next } }))
    setLocal(cfg); useAppStore.setState({ config: cfg })
  }
  const setFsrs = async (patch: Partial<Config['fsrs']>) => {
    const cfg = await unwrap(window.api.updateConfig({ fsrs: { ...local.fsrs, ...patch } }))
    setLocal(cfg); useAppStore.setState({ config: cfg })
  }
  const setExternalEditor = async (s: string) => {
    const cfg = await unwrap(window.api.updateConfig({ externalEditor: s || null }))
    setLocal(cfg); useAppStore.setState({ config: cfg })
  }

  const sorted = [...local.dashboard.widgets].sort((a, b) => a.order - b.order)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Data folder</h2>
        <div className="text-xs text-muted break-all">{local.rootPath}</div>
        <p className="text-xs text-muted mt-2">Changing this requires restart (v1 has no relocate wizard yet).</p>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Dashboard widgets</h2>
        <div className="flex flex-col gap-2">
          {sorted.map(w => (
            <div key={w.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={w.enabled} onChange={() => toggle(w.id)} />
              <span className="flex-1">{w.id}</span>
              <button onClick={() => move(w.id, -1)} className="text-xs text-muted hover:text-fg">↑</button>
              <button onClick={() => move(w.id, 1)} className="text-xs text-muted hover:text-fg">↓</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">FSRS</h2>
        <label className="flex items-center gap-2 text-sm mb-2">
          <span className="w-48">Desired retention</span>
          <input type="number" step="0.01" min={0.5} max={0.99} value={local.fsrs.desiredRetention}
            onChange={e => setFsrs({ desiredRetention: Number(e.target.value) })}
            className="w-24 bg-transparent border border-border rounded px-2 py-1" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-48">Max interval (days)</span>
          <input type="number" step="1" min={1} value={local.fsrs.maximumInterval}
            onChange={e => setFsrs({ maximumInterval: Number(e.target.value) })}
            className="w-24 bg-transparent border border-border rounded px-2 py-1" />
        </label>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">External editor</h2>
        <input type="text" placeholder="e.g. code, cursor, subl" value={local.externalEditor ?? ''}
          onChange={e => setExternalEditor(e.target.value)}
          className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm" />
        <p className="text-xs text-muted mt-2">Leave blank to use the system default opener.</p>
        <p className="text-xs text-muted mt-1">Available widget ids: {WIDGET_IDS.join(', ')}</p>
      </section>
    </div>
  )
}
