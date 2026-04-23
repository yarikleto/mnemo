import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CardFull } from '../../shared/schema'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'
import { MarkdownView } from '../components/markdown-view'

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden="true">
      <path
        d="M11.2 2.6a1.4 1.4 0 0 1 2 2L5.5 12.3l-2.8.5.5-2.8L11.2 2.6z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"
      />
    </svg>
  )
}

export function CardViewRoute() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { refreshNamespaces } = useAppStore()
  const [card, setCard] = useState<CardFull | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    unwrap(window.api.readCard(id))
      .then(c => { if (alive) setCard(c) })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'e' || e.key === 'E') { navigate(`/editor/${id}`) }
      else if (e.key === 'Escape') { navigate('/browse') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, navigate])

  const openExternal = async () => {
    if (!card) return
    await unwrap(window.api.openInExternalEditor(card.id))
  }

  const remove = async () => {
    if (!card) return
    const confirmed = window.confirm(`Delete "${card.question}"? This cannot be undone.`)
    if (!confirmed) return
    await unwrap(window.api.deleteCard(card.id))
    await refreshNamespaces()
    navigate('/browse')
  }

  const breadcrumb = useMemo(() => card?.namespace.split('/').join(' › ') ?? '', [card])

  if (error) {
    return <div className="p-10 text-danger font-editorial italic">Card not found: {error}</div>
  }
  if (!card) {
    return <div className="p-10 text-muted italic font-editorial">Loading…</div>
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-sidebar/60">
        <div className="px-7 pt-5 pb-4 flex items-center justify-between gap-3">
          <div className="eyebrow">View card</div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/editor/${card.id}`)} className="btn-primary !py-1.5 !px-3 !text-[12px] flex items-center gap-1.5">
              <PencilIcon />
              Edit <span className="kbd !bg-white/20 !border-white/25 !text-white !shadow-none !h-[1.1rem] !text-[10px]">E</span>
            </button>
            <button onClick={openExternal} className="btn !py-1.5 !px-3 !text-[12px]">Open externally</button>
            <button onClick={remove} className="btn !py-1.5 !px-3 !text-[12px] !text-danger hover:!border-danger/60">Delete</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-[720px] mx-auto px-8 pt-12 pb-24">
          <div className="eyebrow mb-5">{breadcrumb || 'root'}</div>

          <h1 className="font-editorial text-[30px] leading-[1.25] font-semibold text-fg mb-8 tracking-[-0.015em]">
            {card.question}
          </h1>

          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-10">
              {card.tags.map(t => (
                <span key={t} className="text-[11px] px-1.5 py-0.5 bg-border/50 rounded text-muted">{t}</span>
              ))}
            </div>
          )}

          <div className="h-px bg-border mb-8" />

          {card.body.trim() ? (
            <MarkdownView content={card.body} basePath={card.path} />
          ) : (
            <div className="text-muted text-[14px] italic font-editorial">No answer written yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
