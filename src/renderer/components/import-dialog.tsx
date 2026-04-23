import { useEffect, useState } from 'react'
import type { ArchivePreview, ImportSummary } from '../../shared/api'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

type Props = { onClose: () => void }

type Stage =
  | { kind: 'picking' }
  | { kind: 'ready'; path: string; preview: ArchivePreview }
  | { kind: 'done'; summary: ImportSummary }

const NS_PATTERN = /^(?:[^/\\:*?"<>|.\0][^/\\:*?"<>|\0]*(?:\/[^/\\:*?"<>|.\0][^/\\:*?"<>|\0]*)*)?$/

export function ImportDialog({ onClose }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'picking' })
  const [target, setTarget] = useState('imported')
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { refreshNamespaces } = useAppStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    if (stage.kind !== 'picking') return
    window.api.pickImportFile().then(r => {
      if (cancelled) return
      if (!r.ok) { setErr(r.error); return }
      if (!r.data) { onClose(); return }
      setStage({ kind: 'ready', path: r.data.path, preview: r.data.preview })
    })
    return () => { cancelled = true }
  }, [stage.kind, onClose])

  const targetValid = NS_PATTERN.test(target.trim())

  const doImport = async () => {
    if (stage.kind !== 'ready' || busy || !targetValid) return
    setBusy(true)
    setErr(null)
    try {
      const summary = await unwrap(window.api.importArchive({
        path: stage.path,
        targetNamespace: target.trim(),
        overwrite
      }))
      await refreshNamespaces()
      setStage({ kind: 'done', summary })
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
        className="bg-bg border border-border rounded-lg shadow-2xl w-full max-w-[520px] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="eyebrow">Import archive</div>
          <button onClick={onClose} className="btn !py-1 !px-2.5 !text-[12px]">
            Close <span className="kbd">Esc</span>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {stage.kind === 'picking' && (
            <div className="text-[13px] text-muted">Opening file picker…</div>
          )}

          {stage.kind === 'ready' && (
            <>
              <div className="text-[13px] text-fg">
                <span className="font-mono text-muted">{stage.path}</span>
              </div>
              <div className="text-[12px] text-muted">
                {stage.preview.cardCount} card{stage.preview.cardCount === 1 ? '' : 's'} · exported {stage.preview.exportedAt.slice(0, 10)}
              </div>

              <label className="flex flex-col gap-1">
                <span className="eyebrow">Target namespace</span>
                <input
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="(root)"
                  className={`bg-transparent border rounded px-3 py-1.5 text-[13px] outline-none focus:border-accent ${
                    targetValid ? 'border-border' : 'border-danger'
                  }`}
                />
                {!targetValid && (
                  <span className="text-[11px] text-danger">
                    Invalid namespace. Use forward-slash separated segments, no leading/trailing slash.
                  </span>
                )}
              </label>

              <label className="flex items-center gap-2 text-[12.5px] text-fg cursor-pointer">
                <input type="checkbox" className="w-3 h-3" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
                Overwrite existing cards with same ID
              </label>
            </>
          )}

          {stage.kind === 'done' && (
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="text-fg">
                Imported {stage.summary.imported} · skipped {stage.summary.skipped} · overwrote {stage.summary.overwritten}
              </div>
              {stage.summary.warnings.length > 0 && (
                <details className="text-[12px] text-muted">
                  <summary className="cursor-pointer">{stage.summary.warnings.length} warning{stage.summary.warnings.length === 1 ? '' : 's'}</summary>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    {stage.summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {err && <div className="text-[12px] text-danger">{err}</div>}
        </div>

        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
          {stage.kind === 'ready' && (
            <>
              <button onClick={onClose} className="btn !py-1.5 !px-3 !text-[12px]">Cancel</button>
              <button
                onClick={doImport}
                className="btn-primary !py-1.5 !px-3 !text-[12px]"
                disabled={busy || !targetValid}
              >
                {busy ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
          {stage.kind === 'done' && (
            <button onClick={onClose} className="btn-primary !py-1.5 !px-3 !text-[12px]">Done</button>
          )}
        </div>
      </div>
    </div>
  )
}
