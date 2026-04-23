import { useEffect, useState } from 'react'
import { WIDGET_INFO, type WidgetId } from '../../shared/constants'
import type { Config } from '../../shared/schema'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'

export function SettingsRoute() {
  const { config } = useAppStore()
  const [local, setLocal] = useState<Config | null>(config)
  useEffect(() => { setLocal(config) }, [config])
  if (!local) return <div className="p-10 text-muted italic font-editorial">Loading…</div>

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

  const sectionHeading = (label: string) => (
    <div className="eyebrow mb-3 pt-1">{label}</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="eyebrow mb-1.5">Preferences</div>
      <h1 className="font-editorial text-[28px] font-semibold leading-none mb-10">Settings</h1>

      <section className="mb-10">
        {sectionHeading('Data folder')}
        <div className="card-surface p-4 font-mono text-[12px] text-muted break-all">{local.rootPath}</div>
        <p className="text-[12px] text-muted mt-2 italic">Changing this requires restart (v1 has no relocate wizard yet).</p>
      </section>

      <section className="mb-10">
        {sectionHeading('Dashboard widgets')}
        <div className="card-surface divide-y divide-border overflow-hidden">
          {sorted.map(w => {
            const info = WIDGET_INFO[w.id]
            return (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" checked={w.enabled} onChange={() => toggle(w.id)} className="w-3.5 h-3.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">{info.title}</div>
                  <div className="text-[11.5px] text-muted mt-0.5 leading-snug">{info.description}</div>
                </div>
                <button onClick={() => move(w.id, -1)} className="btn-ghost !p-1.5 text-muted hover:text-fg shrink-0" aria-label="Move up">↑</button>
                <button onClick={() => move(w.id, 1)}  className="btn-ghost !p-1.5 text-muted hover:text-fg shrink-0" aria-label="Move down">↓</button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-10">
        {sectionHeading('FSRS algorithm')}
        <div className="card-surface p-5 flex flex-col gap-4">
          <label className="flex items-center justify-between gap-4 text-[13px]">
            <div>
              <div className="font-medium">Desired retention</div>
              <div className="text-[11.5px] text-muted">Target recall probability (0.5 – 0.99)</div>
            </div>
            <input type="number" step="0.01" min={0.5} max={0.99} value={local.fsrs.desiredRetention}
              onChange={e => setFsrs({ desiredRetention: Number(e.target.value) })}
              className="input w-28 text-right font-mono" />
          </label>
          <div className="h-px bg-border" />
          <label className="flex items-center justify-between gap-4 text-[13px]">
            <div>
              <div className="font-medium">Max interval</div>
              <div className="text-[11.5px] text-muted">Ceiling for spacing (days)</div>
            </div>
            <input type="number" step="1" min={1} value={local.fsrs.maximumInterval}
              onChange={e => setFsrs({ maximumInterval: Number(e.target.value) })}
              className="input w-28 text-right font-mono" />
          </label>
        </div>
      </section>

      <section>
        {sectionHeading('External editor')}
        <input type="text" placeholder="e.g. code, cursor, subl" value={local.externalEditor ?? ''}
          onChange={e => setExternalEditor(e.target.value)}
          className="input w-full font-mono" />
        <p className="text-[12px] text-muted mt-2 italic">Leave blank to use the system default opener.</p>
      </section>
    </div>
  )
}
