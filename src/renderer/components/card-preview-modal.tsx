import { useEffect, useState } from 'react'
import { MarkdownView } from './markdown-view'

type Props = {
  prompts: string[]
  body: string
  basePath?: string
  onClose: () => void
}

export function CardPreviewModal({ prompts, body, basePath, onClose }: Props) {
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === ' ') { e.preventDefault(); setRevealed(r => !r); return }
      if (prompts.length > 1) {
        if (e.key === 'ArrowLeft') { setIdx(i => (i - 1 + prompts.length) % prompts.length); setRevealed(false) }
        if (e.key === 'ArrowRight') { setIdx(i => (i + 1) % prompts.length); setRevealed(false) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prompts.length, onClose])

  const safeIdx = Math.min(idx, Math.max(0, prompts.length - 1))
  const prompt = prompts[safeIdx] ?? ''
  const empty = prompts.length === 0 || !prompt.trim()

  return (
    <div
      className="fixed inset-0 z-50 bg-fg/30 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-border rounded-lg shadow-2xl w-full max-w-[760px] max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="eyebrow flex items-center gap-3">
            <span>Preview</span>
            {prompts.length > 1 && (
              <>
                <span className="text-border">·</span>
                <span className="text-muted normal-case">variant {safeIdx + 1} / {prompts.length}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {prompts.length > 1 && (
              <>
                <button
                  onClick={() => { setIdx((safeIdx - 1 + prompts.length) % prompts.length); setRevealed(false) }}
                  className="btn !py-1 !px-2 !text-[12px]"
                  aria-label="Previous variant"
                >←</button>
                <button
                  onClick={() => { setIdx((safeIdx + 1) % prompts.length); setRevealed(false) }}
                  className="btn !py-1 !px-2 !text-[12px]"
                  aria-label="Next variant"
                >→</button>
              </>
            )}
            <button onClick={onClose} className="btn !py-1 !px-2.5 !text-[12px]">
              Close <span className="kbd">Esc</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-10">
          {empty ? (
            <div className="text-muted italic text-[14px] font-editorial">
              {prompts.length === 0 ? 'No prompts yet — add one to preview.' : 'This prompt is empty.'}
            </div>
          ) : (
            <>
              <div className="mb-8">
                <MarkdownView
                  content={prompt}
                  basePath={basePath}
                  className="prose-question font-editorial text-[24px] leading-[1.3] font-semibold text-fg tracking-[-0.015em] max-w-none"
                />
              </div>

              {revealed ? (
                <>
                  <div className="h-px bg-border mb-8" />
                  {body.trim()
                    ? <MarkdownView content={body} basePath={basePath} />
                    : <div className="text-muted italic text-[14px] font-editorial">No answer body yet.</div>}
                </>
              ) : (
                <button onClick={() => setRevealed(true)} className="btn-primary">
                  Reveal answer <span className="kbd !bg-white/20 !border-white/25 !text-white !shadow-none">Space</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
