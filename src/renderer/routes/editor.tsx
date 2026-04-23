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
      })
    }
  }, [mode, id])

  const save = async () => {
    const tagsArr = tags.split(',').map(s => s.trim()).filter(Boolean)
    if (mode === 'new' || !loadedId) {
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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-3 flex gap-2 items-center">
        <input
          className="flex-1 bg-transparent text-lg font-serif font-medium focus:outline-none"
          placeholder="Question…"
          value={question}
          onChange={e => { setQuestion(e.target.value); scheduleAutosave() }}
        />
        <input
          className="w-56 bg-transparent text-sm border border-border rounded px-2 py-1"
          placeholder="namespace (e.g. system-design/caching)"
          value={namespace}
          onChange={e => { setNamespace(e.target.value); scheduleAutosave() }}
        />
        <input
          className="w-48 bg-transparent text-sm border border-border rounded px-2 py-1"
          placeholder="tags, comma separated"
          value={tags}
          onChange={e => { setTags(e.target.value); scheduleAutosave() }}
        />
        <button onClick={save} className="text-sm border border-border rounded px-3 py-1 hover:bg-border/40">Save</button>
        <button onClick={openExternal} disabled={!loadedId} className="text-sm border border-border rounded px-3 py-1 hover:bg-border/40 disabled:opacity-50">Open externally</button>
        <span className="text-xs text-muted">{status}</span>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-border">
          <CodeMirrorEditor value={body} onChange={(v) => { setBody(v); scheduleAutosave() }} />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <MarkdownView content={previewBody} />
        </div>
      </div>
    </div>
  )
}
