import { useEffect, useMemo, useState } from 'react'
import type { CardMeta } from '../../shared/schema'
import { unwrap } from '../lib/api'
import { promptPreview } from '../../shared/prompt'

type Props = { onClose: () => void }

export function ExportDialog({ onClose }: Props) {
  const [cards, setCards] = useState<CardMeta[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    window.api.listCards().then(r => {
      if (r.ok) setCards(r.data)
      else setLoadError(r.error)
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!cards) return []
    const q = query.trim().toLowerCase()
    if (!q) return cards
    return cards.filter(c =>
      c.namespace.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q)) ||
      c.prompts.some(p => p.text.toLowerCase().includes(q))
    )
  }, [cards, query])

  const groups = useMemo(() => {
    const by = new Map<string, CardMeta[]>()
    for (const c of filtered) {
      const k = c.namespace || '(root)'
      if (!by.has(k)) by.set(k, [])
      by.get(k)!.push(c)
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const toggleCard = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const toggleGroup = (ids: string[]) => {
    const allIn = ids.every(id => selected.has(id))
    const next = new Set(selected)
    if (allIn) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    setSelected(next)
  }

  const toggleCollapse = (key: string) => {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key); else next.add(key)
    setCollapsed(next)
  }

  const selectAllVisible = () => {
    const next = new Set(selected)
    for (const c of filtered) next.add(c.id)
    setSelected(next)
  }

  const clearAll = () => setSelected(new Set())

  const doExport = async () => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setErr(null)
    try {
      const r = await unwrap(window.api.exportCards({ ids: [...selected] }))
      if (r) setResult(r.path)
      else onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-fg/30 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-border rounded-lg shadow-2xl w-full max-w-[720px] max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="eyebrow">Export cards</div>
          <button onClick={onClose} className="btn !py-1 !px-2.5 !text-[12px]">
            Close <span className="kbd">Esc</span>
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by prompt, tag, or namespace…"
            className="flex-1 bg-transparent border border-border rounded px-3 py-1.5 text-[13px] outline-none focus:border-accent"
          />
          <button onClick={selectAllVisible} className="btn !py-1 !px-2.5 !text-[12px]" disabled={!cards || filtered.length === 0}>
            Select visible
          </button>
          <button onClick={clearAll} className="btn !py-1 !px-2.5 !text-[12px]" disabled={selected.size === 0}>
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-auto px-3 py-2">
          {loadError && <div className="px-3 py-4 text-[13px] text-danger">Failed to load cards: {loadError}</div>}
          {!loadError && !cards && <div className="px-3 py-4 text-[13px] text-muted">Loading…</div>}
          {cards && groups.length === 0 && (
            <div className="px-3 py-4 text-[13px] text-muted">No matching cards.</div>
          )}
          {cards && groups.map(([ns, list]) => {
            const ids = list.map(c => c.id)
            const selectedCount = ids.filter(id => selected.has(id)).length
            const tri: 'none' | 'some' | 'all' =
              selectedCount === 0 ? 'none' : selectedCount === ids.length ? 'all' : 'some'
            const isCollapsed = collapsed.has(ns)
            return (
              <div key={ns} className="mb-2">
                <div
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-sidebar cursor-pointer select-none"
                  onClick={() => toggleCollapse(ns)}
                >
                  <input
                    type="checkbox"
                    className="w-3 h-3"
                    checked={tri === 'all'}
                    ref={el => { if (el) el.indeterminate = tri === 'some' }}
                    onChange={e => { e.stopPropagation(); toggleGroup(ids) }}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="text-[12.5px] font-medium text-fg flex-1 truncate">{ns}</span>
                  <span className="text-[11px] font-mono text-muted/80 tabular-nums">
                    {selectedCount}/{ids.length}
                  </span>
                  <span className="text-muted text-[10px] w-3 text-center">{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {!isCollapsed && list.map(c => (
                  <label
                    key={c.id}
                    className="flex items-start gap-2 px-2 py-1 pl-6 text-[12.5px] rounded hover:bg-sidebar cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="w-3 h-3 mt-[3px]"
                      checked={selected.has(c.id)}
                      onChange={() => toggleCard(c.id)}
                    />
                    <span className="flex-1 text-muted line-clamp-2">
                      {promptPreview(c.prompts[0]?.text ?? '', 120) || <em className="text-muted/70">untitled</em>}
                    </span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>

        <div className="px-6 py-3 border-t border-border flex items-center gap-3">
          <div className="text-[12px] text-muted flex-1">
            {result
              ? <span className="text-fg">Exported to <span className="font-mono">{result}</span></span>
              : err
                ? <span className="text-danger">{err}</span>
                : `${selected.size} card${selected.size === 1 ? '' : 's'} selected`}
          </div>
          <button onClick={onClose} className="btn !py-1.5 !px-3 !text-[12px]">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={doExport}
              className="btn-primary !py-1.5 !px-3 !text-[12px]"
              disabled={selected.size === 0 || busy}
            >
              {busy ? 'Exporting…' : 'Export…'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
