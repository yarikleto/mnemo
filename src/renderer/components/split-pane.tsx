import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  direction: 'horizontal' | 'vertical'
  storageKey: string
  defaultSize?: number        // fraction 0..1 for first pane
  minFirst?: number           // px
  minSecond?: number          // px
  first: ReactNode
  second: ReactNode
  className?: string
}

export function SplitPane({
  direction, storageKey, defaultSize = 0.5, minFirst = 120, minSecond = 120,
  first, second, className = ''
}: Props) {
  const isHorizontal = direction === 'horizontal'
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<number>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(`split:${storageKey}`) : null
    const n = saved ? parseFloat(saved) : defaultSize
    return Number.isFinite(n) && n > 0 && n < 1 ? n : defaultSize
  })
  const draggingRef = useRef(false)

  useEffect(() => {
    try { localStorage.setItem(`split:${storageKey}`, String(size)) } catch { /* ignore */ }
  }, [storageKey, size])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    draggingRef.current = true
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const total = isHorizontal ? rect.width : rect.height
    if (total <= 0) return
    const offset = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top
    const clamped = Math.max(minFirst, Math.min(total - minSecond, offset))
    setSize(clamped / total)
  }, [isHorizontal, minFirst, minSecond])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }, [])

  const firstStyle = isHorizontal
    ? { width: `${size * 100}%`, flex: `0 0 ${size * 100}%` }
    : { height: `${size * 100}%`, flex: `0 0 ${size * 100}%` }

  return (
    <div
      ref={containerRef}
      className={`${isHorizontal ? 'flex flex-row' : 'flex flex-col'} ${className}`}
    >
      <div style={firstStyle} className="min-w-0 min-h-0 overflow-hidden">{first}</div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={
          isHorizontal
            ? 'w-[3px] shrink-0 cursor-col-resize bg-border/80 hover:bg-accent active:bg-accent transition-colors'
            : 'h-[3px] shrink-0 cursor-row-resize bg-border/80 hover:bg-accent active:bg-accent transition-colors'
        }
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">{second}</div>
    </div>
  )
}
