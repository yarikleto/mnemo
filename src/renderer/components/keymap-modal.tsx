import { useEffect } from 'react'

type Binding = { keys: string[]; label: string }
type Section = { title: string; bindings: Binding[] }

const SECTIONS: Section[] = [
  {
    title: 'Global',
    bindings: [
      { keys: ['Cmd', 'N'], label: 'New card' },
      { keys: ['Cmd', ','], label: 'Open settings' },
      { keys: ['Cmd', '1'], label: 'Review' },
      { keys: ['Cmd', '2'], label: 'Browse' },
      { keys: ['Cmd', '3'], label: 'Dashboard' },
      { keys: ['Cmd', '4'], label: 'Settings' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Review',
    bindings: [
      { keys: ['Space'], label: 'Reveal answer' },
      { keys: ['1'], label: 'Rate Again' },
      { keys: ['2'], label: 'Rate Hard' },
      { keys: ['3'], label: 'Rate Good' },
      { keys: ['4'], label: 'Rate Easy' },
      { keys: ['E'], label: 'Edit current card' },
    ],
  },
  {
    title: 'Browse',
    bindings: [
      { keys: ['Cmd', 'F'], label: 'Focus search' },
      { keys: ['/'], label: 'Focus search' },
      { keys: ['Esc'], label: 'Blur search input' },
    ],
  },
  {
    title: 'Editor',
    bindings: [
      { keys: ['Cmd', 'S'], label: 'Save card' },
    ],
  },
  {
    title: 'Card view',
    bindings: [
      { keys: ['E'], label: 'Edit card' },
      { keys: ['Esc'], label: 'Back to browse' },
    ],
  },
  {
    title: 'Card preview / modals',
    bindings: [
      { keys: ['Space'], label: 'Toggle reveal' },
      { keys: ['←'], label: 'Previous prompt variant' },
      { keys: ['→'], label: 'Next prompt variant' },
      { keys: ['Esc'], label: 'Close' },
    ],
  },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const renderKey = (k: string) => k === 'Cmd' ? (isMac ? '⌘' : 'Ctrl') : k

export function KeymapModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-fg/30 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keymap-modal-title"
    >
      <div
        className="bg-bg border border-border rounded-lg shadow-2xl w-full max-w-[640px] max-h-[88vh] flex flex-col animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 id="keymap-modal-title" className="font-editorial text-[18px] font-semibold leading-none">Keyboard shortcuts</h2>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-[12px]" aria-label="Close">Esc</button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {SECTIONS.map((s, si) => (
            <div
              key={s.title}
              className="animate-fade-in-up"
              style={{ animationDelay: `${60 + si * 35}ms` }}
            >
              <div className="eyebrow mb-2">{s.title}</div>
              <ul className="flex flex-col gap-1.5">
                {s.bindings.map((b, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-fg">{b.label}</span>
                    <span className="flex gap-1 shrink-0">
                      {b.keys.map((k, ki) => (
                        <kbd key={ki} className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border bg-surface text-muted min-w-[20px] text-center">
                          {renderKey(k)}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
