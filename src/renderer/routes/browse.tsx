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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search questions or tags…"
          className="flex-1 bg-transparent border border-border rounded px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted">{filtered.length} of {rows.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted border-b border-border">
          <tr><th className="py-2 pr-4">Question</th><th className="pr-4">Namespace</th><th className="pr-4">Tags</th></tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} onClick={() => navigate(`/editor/${r.id}`)} className="cursor-pointer hover:bg-border/30 border-b border-border/60">
              <td className="py-2 pr-4 font-serif">{r.question}</td>
              <td className="pr-4 text-muted">{r.namespace || '—'}</td>
              <td className="pr-4 text-muted">{r.tags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
