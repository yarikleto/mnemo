import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CardMeta } from '../../shared/schema'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

export function BrowseRoute() {
  const navigate = useNavigate()
  const { selectedNamespaces } = useAppStore()
  const [rows, setRows] = useState<CardMeta[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    unwrap(window.api.listCards()).then(setRows)
  }, [])

  const filtered = useMemo(() => {
    const lc = query.toLowerCase().trim()
    return rows.filter(r => {
      if (selectedNamespaces.length && !selectedNamespaces.some(ns => r.namespace === ns || r.namespace.startsWith(ns + '/'))) return false
      if (!lc) return true
      return r.question.toLowerCase().includes(lc) || r.tags.some(t => t.toLowerCase().includes(lc))
    })
  }, [rows, query, selectedNamespaces])

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-8 pb-5 border-b border-border bg-sidebar/50">
        <div className="eyebrow mb-1.5">Browse</div>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-editorial text-[26px] font-semibold leading-none">All cards</h1>
          <div className="text-[12px] text-muted tabular-nums">
            <span className="font-semibold text-fg">{filtered.length}</span>
            <span className="mx-1">of</span>
            <span>{rows.length}</span>
          </div>
        </div>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search questions or tags…"
          className="input w-full mt-5"
        />
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted italic font-editorial">
            {rows.length === 0 ? 'No cards yet.' : 'No matches.'}
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="eyebrow !text-left px-4 py-2.5">Question</th>
                  <th className="eyebrow !text-left px-4 py-2.5 w-56">Namespace</th>
                  <th className="eyebrow !text-left px-4 py-2.5 w-48">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/editor/${r.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-accent/5 ${i === filtered.length - 1 ? '' : 'border-b border-border/60'}`}
                  >
                    <td className="px-4 py-3 font-editorial text-[14.5px] text-fg">{r.question}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-muted">{r.namespace || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.tags.length === 0 ? <span className="text-muted">—</span> : r.tags.map(t => (
                          <span key={t} className="text-[11px] px-1.5 py-0.5 bg-border/50 rounded text-muted">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
