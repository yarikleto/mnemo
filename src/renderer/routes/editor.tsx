import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CodeMirrorEditor } from '../components/codemirror-editor'
import { MarkdownView } from '../components/markdown-view'
import { SplitPane } from '../components/split-pane'
import { ScrollFade } from '../components/scroll-fade'
import { CardPreviewModal } from '../components/card-preview-modal'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

type PromptDraft = { key: string; id?: string; text: string }

function draftKey(): string { return Math.random().toString(36).slice(2) }

export function EditorRoute({ mode }: { mode: 'new' | 'edit' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [qs] = useSearchParams()
  const { refreshNamespaces } = useAppStore()
  const [namespace, setNamespace] = useState(qs.get('ns') ?? '')
  const [tags, setTags] = useState('')
  const [prompts, setPrompts] = useState<PromptDraft[]>([{ key: draftKey(), text: '' }])
  const [body, setBody] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [cardPath, setCardPath] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (mode === 'edit' && id) {
      unwrap(window.api.readCard(id)).then(c => {
        setNamespace(c.namespace)
        setTags(c.tags.join(', '))
        setPrompts(c.prompts.map(p => ({ key: draftKey(), id: p.id, text: p.text })))
        setBody(c.body)
        setLoadedId(c.id)
        setCardPath(c.path)
        setStatus('')
        if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
      })
    }
  }, [mode, id])

  const validPrompts = () => prompts.map(p => ({ id: p.id, text: p.text.trim() })).filter(p => p.text.length > 0)

  const save = async (explicit = false) => {
    const tagsArr = tags.split(',').map(s => s.trim()).filter(Boolean)
    const cleaned = validPrompts()
    if (mode === 'new' || !loadedId) {
      if (mode !== 'new') return
      if (cleaned.length === 0) { if (explicit) setStatus('At least one prompt required'); return }
      const created = await unwrap(window.api.createCard({
        namespace, prompts: cleaned.map(p => p.text), body, tags: tagsArr
      }))
      setLoadedId(created.id)
      setCardPath(created.path)
      setPrompts(created.prompts.map(p => ({ key: draftKey(), id: p.id, text: p.text })))
      setStatus('Saved')
      await refreshNamespaces()
      if (explicit) navigate('/browse')
      else navigate(`/editor/${created.id}`, { replace: true })
      return
    }
    if (cleaned.length === 0) { if (explicit) setStatus('At least one prompt required'); return }
    const fresh = await unwrap(window.api.updateCard({ id: loadedId, prompts: cleaned, body, tags: tagsArr }))
    setCardPath(fresh.path)
    setPrompts(fresh.prompts.map(p => ({ key: draftKey(), id: p.id, text: p.text })))
    if (fresh.namespace !== namespace) {
      const moved = await unwrap(window.api.moveCard({ id: loadedId, namespace }))
      setCardPath(moved.path)
      await refreshNamespaces()
    }
    setStatus('Saved')
    if (explicit) navigate(`/card/${loadedId}`)
  }

  const scheduleAutosave = () => {
    if (!loadedId) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { save(false) }, 2000)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, namespace, tags, body, loadedId])

  const openExternal = async () => {
    if (!loadedId) return
    await unwrap(window.api.openInExternalEditor(loadedId))
  }

  const remove = async () => {
    if (!loadedId) return
    const confirmed = window.confirm(`Delete this card? This cannot be undone.`)
    if (!confirmed) return
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
    await unwrap(window.api.deleteCard(loadedId))
    await refreshNamespaces()
    navigate('/browse')
  }

  const ensureCardThenSaveAsset = async (file: File): Promise<string | null> => {
    let targetId = loadedId
    if (!targetId) {
      const cleaned = validPrompts()
      if (cleaned.length === 0) { setStatus('Add a prompt before pasting images'); return null }
      const tagsArr = tags.split(',').map(s => s.trim()).filter(Boolean)
      const created = await unwrap(window.api.createCard({
        namespace, prompts: cleaned.map(p => p.text), body, tags: tagsArr
      }))
      setLoadedId(created.id)
      setCardPath(created.path)
      setPrompts(created.prompts.map(p => ({ key: draftKey(), id: p.id, text: p.text })))
      await refreshNamespaces()
      navigate(`/editor/${created.id}`, { replace: true })
      targetId = created.id
    }
    const ext = (file.name.match(/\.([^.]+)$/)?.[1] ?? file.type.split('/')[1] ?? 'png').toLowerCase()
    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      const res = await unwrap(window.api.saveAsset({ cardId: targetId, bytes, ext }))
      setStatus('Image saved')
      return res.relativePath
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  const updatePrompt = (key: string, text: string) => {
    setPrompts(ps => ps.map(p => p.key === key ? { ...p, text } : p))
    scheduleAutosave()
  }
  const addPrompt = () => {
    setPrompts(ps => [...ps, { key: draftKey(), text: '' }])
  }
  const removePrompt = (key: string) => {
    setPrompts(ps => ps.length <= 1 ? ps : ps.filter(p => p.key !== key))
    scheduleAutosave()
  }
  const movePrompt = (key: string, dir: -1 | 1) => {
    setPrompts(ps => {
      const i = ps.findIndex(p => p.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ps.length) return ps
      const next = ps.slice()
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
    scheduleAutosave()
  }

  const previewBody = useMemo(() => body, [body])
  const isError = status.endsWith('required') || status === 'Add a prompt before pasting images'

  return (
    <div className="flex flex-col h-full bg-bg">
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
              <button onClick={() => setPreviewOpen(true)} className="btn !py-1.5 !px-3 !text-[12px]">Preview</button>
              <button onClick={openExternal} disabled={!loadedId} className="btn !py-1.5 !px-3 !text-[12px]">Open externally</button>
              <button onClick={remove} disabled={!loadedId} className="btn !py-1.5 !px-3 !text-[12px] !text-danger hover:!border-danger/60">Delete</button>
              <button onClick={() => save(true)} className="btn-primary !py-1.5 !px-4 !text-[12px]">
                Save <span className="kbd !bg-white/20 !border-white/25 !text-white !shadow-none !h-[1.1rem] !text-[10px]">⌘S</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2">
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

      <SplitPane
        direction="vertical"
        storageKey="editor-prompts-body"
        defaultSize={0.35}
        minFirst={140}
        minSecond={200}
        className="flex-1 overflow-hidden"
        first={
          <div className="h-full flex flex-col border-b border-border bg-sidebar/30">
            <div className="px-7 pt-4 pb-3 flex items-center justify-between shrink-0">
              <div className="eyebrow">Prompts · {prompts.length}</div>
              <button onClick={addPrompt} className="btn !py-1 !px-2.5 !text-[11.5px]">+ Add prompt</button>
            </div>
            <ScrollFade className="flex-1 min-h-0">
              <div className="px-7 pb-4 space-y-3">
                {prompts.map((p, i) => (
                  <div key={p.key} className="border border-border rounded-md bg-surface overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1 bg-sidebar/60 border-b border-border">
                      <span className="text-[10.5px] font-mono text-muted uppercase tracking-wider">#{i + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => movePrompt(p.key, -1)}
                          disabled={i === 0}
                          className="text-[13px] text-muted hover:text-fg disabled:opacity-30 px-1"
                          aria-label="Move up"
                        >↑</button>
                        <button
                          onClick={() => movePrompt(p.key, 1)}
                          disabled={i === prompts.length - 1}
                          className="text-[13px] text-muted hover:text-fg disabled:opacity-30 px-1"
                          aria-label="Move down"
                        >↓</button>
                        <button
                          onClick={() => removePrompt(p.key)}
                          disabled={prompts.length <= 1}
                          className="text-[13px] text-muted hover:text-danger disabled:opacity-30 px-1"
                          aria-label="Remove prompt"
                        >×</button>
                      </div>
                    </div>
                    <div className="min-h-[88px]">
                      <CodeMirrorEditor
                        value={p.text}
                        onChange={(v) => updatePrompt(p.key, v)}
                        onPasteImage={ensureCardThenSaveAsset}
                        className="min-h-[88px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollFade>
          </div>
        }
        second={
          <SplitPane
            direction="horizontal"
            storageKey="editor-body-preview"
            defaultSize={0.5}
            minFirst={240}
            minSecond={240}
            className="h-full"
            first={
              <div className="h-full bg-surface border-r border-border">
                <CodeMirrorEditor
                  value={body}
                  onChange={(v) => { setBody(v); scheduleAutosave() }}
                  onPasteImage={ensureCardThenSaveAsset}
                />
              </div>
            }
            second={
              <div className="h-full overflow-auto bg-bg">
                <div className="max-w-[620px] mx-auto px-8 py-10">
                  {previewBody.trim() ? (
                    <MarkdownView content={previewBody} basePath={cardPath ?? undefined} />
                  ) : (
                    <div className="text-muted text-[14px] italic font-editorial">Answer preview appears here.</div>
                  )}
                </div>
              </div>
            }
          />
        }
      />

      {previewOpen && (
        <CardPreviewModal
          prompts={prompts.map(p => p.text)}
          body={body}
          basePath={cardPath ?? undefined}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
