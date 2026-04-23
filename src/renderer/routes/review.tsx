import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CardFull, CardMeta } from '../../shared/schema'
import type { Rating } from '../../shared/constants'
import { RATINGS } from '../../shared/constants'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'
import { MarkdownView } from '../components/markdown-view'

export function ReviewRoute() {
  const navigate = useNavigate()
  const { selectedNamespaces } = useAppStore()
  const [queue, setQueue] = useState<CardMeta[]>([])
  const [current, setCurrent] = useState<CardFull | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [sessionCounts, setSessionCounts] = useState({ reviewed: 0, again: 0 })

  const loadQueue = useCallback(async () => {
    const q = await unwrap(window.api.getDueQueue({ namespaces: selectedNamespaces }))
    setQueue(q)
  }, [selectedNamespaces])

  useEffect(() => { loadQueue() }, [loadQueue])

  useEffect(() => {
    if (!queue.length) { setCurrent(null); return }
    const first = queue[0]!
    unwrap(window.api.readCard(first.id)).then(setCurrent)
    setRevealed(false)
  }, [queue])

  const rate = useCallback(async (rating: Rating) => {
    if (!current) return
    await unwrap(window.api.rateReview({ id: current.id, rating }))
    setSessionCounts(c => ({ reviewed: c.reviewed + 1, again: c.again + (rating === 'Again' ? 1 : 0) }))
    setQueue(q => q.slice(1))
  }, [current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return
      if (e.key === ' ') { e.preventDefault(); setRevealed(true); return }
      if (e.key === 'e' || e.key === 'E') { navigate(`/editor/${current.id}`); return }
      if (!revealed) return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) { rate(RATINGS[n - 1]!) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, rate, navigate])

  const breadcrumb = useMemo(() => current?.namespace.split('/').join(' / ') ?? '', [current])

  if (!current) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold">No cards due.</h2>
        <p className="text-muted mt-2">
          {sessionCounts.reviewed > 0
            ? `Session: ${sessionCounts.reviewed} reviewed · ${sessionCounts.again} again.`
            : 'Create a card or adjust your namespace filters.'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-10">
      <div className="text-xs uppercase tracking-wider text-muted mb-2">{breadcrumb || 'root'}</div>
      <h1 className="text-2xl font-serif font-semibold mb-8 leading-tight">{current.question}</h1>
      {revealed ? (
        <>
          <MarkdownView content={current.body} />
          <div className="mt-10 flex gap-2">
            {RATINGS.map((r, i) => (
              <button
                key={r}
                onClick={() => rate(r)}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-border/40"
              >
                <span className="text-muted mr-2">{i + 1}</span>{r}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="px-4 py-2 border border-border rounded text-sm hover:bg-border/40"
        >
          Reveal answer (Space)
        </button>
      )}
      <div className="mt-12 text-xs text-muted">
        {queue.length} cards in queue · Session: {sessionCounts.reviewed} reviewed, {sessionCounts.again} again
      </div>
    </div>
  )
}
