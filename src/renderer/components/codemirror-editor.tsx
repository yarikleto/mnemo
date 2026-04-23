import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'

export function CodeMirrorEditor({ value, onChange, onPasteImage, className = 'h-full' }: {
  value: string
  onChange: (v: string) => void
  onPasteImage?: (file: File) => Promise<string | null>
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onPasteImageRef = useRef(onPasteImage)
  useEffect(() => { onPasteImageRef.current = onPasteImage }, [onPasteImage])

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          markdown(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.domEventHandlers({
            paste: (event, v) => {
              const handler = onPasteImageRef.current
              if (!handler || !event.clipboardData) return false
              const file = Array.from(event.clipboardData.files).find(f => f.type.startsWith('image/'))
              if (!file) return false
              event.preventDefault()
              handler(file).then(rel => {
                if (!rel) return
                const { from, to } = v.state.selection.main
                const snippet = `![](${rel})`
                v.dispatch({ changes: { from, to, insert: snippet }, selection: { anchor: from + snippet.length } })
              })
              return true
            }
          }),
          EditorView.updateListener.of(u => { if (u.docChanged) onChange(u.state.doc.toString()) })
        ]
      })
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={hostRef} className={className} />
}
