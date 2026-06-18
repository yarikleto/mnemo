import { useEffect, type RefObject } from 'react'

// Shared modal a11y: trap Tab focus inside the dialog panel and restore focus
// to the previously-focused element on unmount. Deliberately does NOT bind
// Escape — every modal already owns its own Escape-to-close listener, so this
// avoids double-binding by construction.
//
// On open: if focus isn't already inside the panel (e.g. an `autoFocus` input
// has not claimed it), move focus to the panel container itself rather than its
// first focusable child. That keeps window-level key shortcuts (Space to reveal,
// arrows to navigate) from being swallowed by a focused button, while still
// pulling focus out of the underlying page so Tab is trapped.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export function useModalA11y(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const panel = ref.current
    if (!panel) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    if (!panel.contains(document.activeElement)) {
      panel.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement)
      if (focusable.length === 0) {
        // Nothing tabbable — keep focus pinned to the panel.
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || active === panel) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', onKeyDown)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [ref])
}
