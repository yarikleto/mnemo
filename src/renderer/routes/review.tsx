import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CardFull, CardMeta } from '../../shared/schema'
import type { Rating } from '../../shared/constants'
import { RATINGS } from '../../shared/constants'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'
import { MarkdownView } from '../components/markdown-view'

const RATING_STYLE: Record<Rating, string> = {
  Again: '!border-red-500 !text-red-600 dark:!text-red-400 hover:!bg-red-500/10',
  Hard:  '!border-orange-500 !text-orange-600 dark:!text-orange-400 hover:!bg-orange-500/10',
  Good:  '!border-emerald-500 !text-emerald-700 dark:!text-emerald-400 hover:!bg-emerald-500/10',
  Easy:  '!border-sky-500 !text-sky-700 dark:!text-sky-400 hover:!bg-sky-500/10',
}

export function ReviewRoute() {
  const navigate = useNavigate()
  const { selectedNamespaces } = useAppStore()
  const [queue, setQueue] = useState<CardMeta[]>([])
  const [initialQueueLen, setInitialQueueLen] = useState(0)
  const [current, setCurrent] = useState<CardFull | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [sessionCounts, setSessionCounts] = useState({ reviewed: 0, again: 0 })

  const loadQueue = useCallback(async () => {
    const q = await unwrap(window.api.getDueQueue({ namespaces: selectedNamespaces }))
    setQueue(q)
    setInitialQueueLen(q.length)
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

  const breadcrumb = useMemo(() => current?.namespace.split('/').join(' › ') ?? '', [current])

  if (!current) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-6 opacity-40">✓</div>
          <h2 className="font-editorial text-2xl font-semibold mb-2">Nothing due right now.</h2>
          <p className="text-muted text-[14px] leading-relaxed">
            {sessionCounts.reviewed > 0
              ? <>You reviewed <span className="font-semibold text-fg">{sessionCounts.reviewed}</span> {sessionCounts.reviewed === 1 ? 'card' : 'cards'} this session{sessionCounts.again > 0 ? <> — <span className="text-danger">{sessionCounts.again}</span> marked again</> : ''}.</>
              : 'Create a card or adjust your namespace filters in the sidebar.'}
          </p>
        </div>
      </div>
    )
  }

  const progress = initialQueueLen > 0 ? (sessionCounts.reviewed / initialQueueLen) * 100 : 0

  return (
    <div className="h-full flex flex-col relative">
      {/* Thin amber progress bar */}
      <div className="h-[2px] bg-border/60 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[640px] mx-auto px-8 pt-16 pb-24">
          {/* Breadcrumb */}
          <div className="eyebrow mb-5">{breadcrumb || 'root'}</div>

          {/* Question — editorial serif */}
          <h1 className="font-editorial text-[30px] leading-[1.25] font-semibold text-fg mb-10 tracking-[-0.015em]">
            {current.question}
          </h1>

          {revealed ? (
            <>
              <div className="h-px bg-border mb-8" />
              <MarkdownView content={current.body} basePath={current.path} />
              <div className="mt-14 pt-8 border-t border-border">
                <div className="eyebrow mb-3">How well did you recall?</div>
                <div className="flex flex-wrap gap-2">
                  {RATINGS.map((r, i) => (
                    <button
                      key={r}
                      onClick={() => rate(r)}
                      className={`btn flex-1 min-w-[120px] ${RATING_STYLE[r]}`}
                    >
                      <span className="kbd">{i + 1}</span>
                      <span>{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <button onClick={() => setRevealed(true)} className="btn-primary">
              Reveal answer <span className="kbd !bg-white/20 !border-white/25 !text-white !shadow-none">Space</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer meta */}
      <div className="px-8 py-2.5 border-t border-border bg-sidebar/50 flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-4">
          <span><span className="font-mono tabular-nums text-fg">{queue.length}</span> in queue</span>
          <span className="text-border">·</span>
          <span><span className="font-mono tabular-nums text-fg">{sessionCounts.reviewed}</span> reviewed</span>
          {sessionCounts.again > 0 && (
            <>
              <span className="text-border">·</span>
              <span><span className="font-mono tabular-nums text-danger">{sessionCounts.again}</span> again</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="kbd">E</span><span>edit</span>
          <span className="text-border mx-1">·</span>
          <span className="kbd">Space</span><span>flip</span>
          <span className="text-border mx-1">·</span>
          <span className="kbd">1-4</span><span>rate</span>
        </div>
      </div>
    </div>
  )
}
