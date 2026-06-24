import { useEffect, useRef, useState } from 'react'
import { WIDGET_INFO, type WidgetId } from '../../shared/constants'
import type { Config } from '../../shared/schema'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'

function NumberField({ value, onChange, step = 1, min, max, ariaLabel }: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  ariaLabel?: string
}) {
  const clamp = (v: number) => {
    if (typeof min === 'number' && v < min) return min
    if (typeof max === 'number' && v > max) return max
    return v
  }
  const decimals = step.toString().split('.')[1]?.length ?? 0
  const round = (v: number) => decimals ? Number(v.toFixed(decimals)) : v
  const bump = (dir: 1 | -1) => onChange(clamp(round(value + dir * step)))

  // Press-and-hold repeats — accelerates after the initial delay.
  const holdTimer = useRef<number | null>(null)
  const stopHold = () => {
    if (holdTimer.current !== null) { window.clearTimeout(holdTimer.current); holdTimer.current = null }
  }
  const startHold = (dir: 1 | -1) => {
    let interval = 240
    const tick = () => {
      bump(dir)
      interval = Math.max(40, interval * 0.85)
      holdTimer.current = window.setTimeout(tick, interval)
    }
    bump(dir)
    holdTimer.current = window.setTimeout(tick, 320)
  }

  return (
    <div className="group relative inline-flex items-center">
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        onChange={e => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="input input-no-spin w-28 text-right font-mono pr-7 tabular-nums"
      />
      <div
        className="absolute right-[5px] inset-y-[5px] flex flex-col gap-[2px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
        aria-hidden="true"
      >
        <button
          type="button" tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); startHold(1) }}
          onMouseUp={stopHold} onMouseLeave={stopHold}
          className="flex-1 w-4 rounded-[3px] text-muted hover:text-accent hover:bg-border/60 active:scale-90 transition flex items-center justify-center"
        >
          <svg viewBox="0 0 8 5" className="w-[7px] h-[5px]" fill="currentColor"><path d="M4 0l4 5H0z"/></svg>
        </button>
        <button
          type="button" tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); startHold(-1) }}
          onMouseUp={stopHold} onMouseLeave={stopHold}
          className="flex-1 w-4 rounded-[3px] text-muted hover:text-accent hover:bg-border/60 active:scale-90 transition flex items-center justify-center"
        >
          <svg viewBox="0 0 8 5" className="w-[7px] h-[5px]" fill="currentColor"><path d="M0 0h8L4 5z"/></svg>
        </button>
      </div>
    </div>
  )
}

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
  const setAutoUpdate = async (enabled: boolean) => {
    const cfg = await unwrap(window.api.updateConfig({ autoUpdate: { enabled } }))
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
        <div className="card-surface p-4 font-mono text-[12px] text-muted break-all">{local.rootPath || '(no vault picked yet)'}</div>
      </section>

      <section className="mb-10">
        {sectionHeading('Dashboard widgets')}
        <div className="card-surface divide-y divide-border overflow-hidden">
          {sorted.map((w, i) => {
            const info = WIDGET_INFO[w.id]
            return (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                  <input type="checkbox" checked={w.enabled} onChange={() => toggle(w.id)} className="w-3.5 h-3.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{info.title}</div>
                    <div className="text-[11.5px] text-muted mt-0.5 leading-snug">{info.description}</div>
                  </div>
                </label>
                <button onClick={() => move(w.id, -1)} disabled={i === 0} className="btn-ghost !p-1.5 text-muted hover:text-fg disabled:opacity-30 shrink-0" aria-label="Move up">↑</button>
                <button onClick={() => move(w.id, 1)}  disabled={i === sorted.length - 1} className="btn-ghost !p-1.5 text-muted hover:text-fg disabled:opacity-30 shrink-0" aria-label="Move down">↓</button>
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
            <NumberField
              value={local.fsrs.desiredRetention}
              step={0.01} min={0.5} max={0.99}
              ariaLabel="Desired retention"
              onChange={v => setFsrs({ desiredRetention: v })}
            />
          </label>
          <div className="h-px bg-border" />
          <label className="flex items-center justify-between gap-4 text-[13px]">
            <div>
              <div className="font-medium">Max interval</div>
              <div className="text-[11.5px] text-muted">Ceiling for spacing (days)</div>
            </div>
            <NumberField
              value={local.fsrs.maximumInterval}
              step={1} min={1}
              ariaLabel="Max interval"
              onChange={v => setFsrs({ maximumInterval: v })}
            />
          </label>
        </div>
      </section>

      <section className="mb-10">
        {sectionHeading('External editor')}
        <input type="text" placeholder="e.g. code, cursor, subl" value={local.externalEditor ?? ''}
          onChange={e => setExternalEditor(e.target.value)}
          className="input w-full font-mono" />
        <p className="text-[12px] text-muted mt-2 italic">Leave blank to use the system default opener.</p>
      </section>

      <section>
        {sectionHeading('Updates')}
        <div className="card-surface p-5">
          <label className="flex items-center justify-between gap-4 text-[13px] cursor-pointer">
            <div>
              <div className="font-medium">Automatic updates</div>
              <div className="text-[11.5px] text-muted">Check for new versions in the background and offer a restart-to-apply banner.</div>
            </div>
            <input
              type="checkbox"
              className="w-3.5 h-3.5 shrink-0"
              checked={local.autoUpdate.enabled}
              onChange={e => setAutoUpdate(e.target.checked)}
            />
          </label>
          {!local.autoUpdate.enabled && (
            <p className="text-[11.5px] text-muted mt-3 italic">
              Mnemo will stop checking for new versions; you’ll need to download updates manually from GitHub.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
