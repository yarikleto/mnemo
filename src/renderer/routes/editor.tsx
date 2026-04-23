import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CodeMirrorEditor } from '../components/codemirror-editor'
import { MarkdownView } from '../components/markdown-view'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

export function EditorRoute({ mode }: { mode: 'new' | 'edit' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [qs] = useSearchParams()
  const { refreshNamespaces } = useAppStore()
  const [question, setQuestion] = useState('')
  const [namespace, setNamespace] = useState(qs.get('ns') ?? '')
  const [tags, setTags] = useState('')
  const [body, setBody] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (mode === 'edit' && id) {
      unwrap(window.api.readCard(id)).then(c => {
        setQuestion(c.question); setNamespace(c.namespace); setTags(c.tags.join(', ')); setBody(c.body)
        setLoadedId(c.id)
        setStatus('')
        if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
      })
    }
  }, [mode, id])

  const save = async () => {
    const tagsArr = tags.split(',').map(s => s.trim()).filter(Boolean)
    if (mode === 'new' || !loadedId) {
      if (mode !== 'new') return
      if (!question.trim()) { setStatus('Question required'); return }
      const created = await unwrap(window.api.createCard({ namespace, question, body, tags: tagsArr }))
      setLoadedId(created.id)
      setStatus('Saved')
      await refreshNamespaces()
      navigate(`/editor/${created.id}`, { replace: true })
      return
    }
    await unwrap(window.api.updateCard({ id: loadedId, question, body, tags: tagsArr }))
    const fresh = await unwrap(window.api.readCard(loadedId))
    if (fresh.namespace !== namespace) {
      await unwrap(window.api.moveCard({ id: loadedId, namespace }))
      await refreshNamespaces()
    }
    setStatus('Saved')
  }

  const scheduleAutosave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { save() }, 2000)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, namespace, tags, body, loadedId])

  const openExternal = async () => {
    if (!loadedId) return
    await unwrap(window.api.openInExternalEditor(loadedId))
  }

  const previewBody = useMemo(() => body, [body])
  const isError = status === 'Question required'

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header: meta strip */}
      <div className="border-b border-border bg-sidebar/60">
        <div className="px-7 pt-5 pb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="eyebrow">{mode === 'new' ? 'New card' : 'Edit card'}</div>
            <div className="flex items-center gap-2">
              {status && (
                isError
                  ? <span className="chip-error">{status}</span>
                  : <span className="text-[11.5px] text-muted italic">{status}</span>
              )}
              <button onClick={openExternal} disabled={!loadedId} className="btn !py-1.5 !px-3 !text-[12px]">Open externally</button>
              <button onClick={save} className="btn-primary !py-1.5 !px-4 !text-[12px]">
                Save <span className="kbd !bg-white/20 !border-white/25 !text-white !shadow-none !h-[1.1rem] !text-[10px]">⌘S</span>
              </button>
            </div>
          </div>

          <input
            className="input-bare w-full font-editorial text-[26px] font-semibold leading-tight tracking-[-0.015em]"
            placeholder="Question…"
            value={question}
            onChange={e => { setQuestion(e.target.value); scheduleAutosave() }}
          />

          <div className="flex gap-2 mt-3">
            <label className="flex items-center gap-2 flex-1">
              <span className="eyebrow shrink-0">NS</span>
              <input
                className="input-bare flex-1 font-mono text-[12.5px]"
                placeholder="system-design/caching"
                value={namespace}
                onChange={e => { setNamespace(e.target.value); scheduleAutosave() }}
              />
            </label>
            <label className="flex items-center gap-2 flex-1">
              <span className="eyebrow shrink-0">Tags</span>
              <input
                className="input-bare flex-1 text-[12.5px]"
                placeholder="redis, cache, distributed"
                value={tags}
                onChange={e => { setTags(e.target.value); scheduleAutosave() }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Split body */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 bg-surface border-r border-border">
          <CodeMirrorEditor value={body} onChange={(v) => { setBody(v); scheduleAutosave() }} />
        </div>
        <div className="flex-1 min-w-0 overflow-auto bg-bg">
          <div className="max-w-[620px] mx-auto px-8 py-10">
            {previewBody.trim() ? (
              <MarkdownView content={previewBody} />
            ) : (
              <div className="text-muted text-[14px] italic font-editorial">Preview appears here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
