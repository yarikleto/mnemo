import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function ScrollFade({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(true)

  const measure = () => {
    const el = ref.current
    if (!el) return
    const canScroll = el.scrollHeight - el.clientHeight > 1
    setAtTop(el.scrollTop <= 1)
    setAtBottom(!canScroll || el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
  }

  useLayoutEffect(() => { measure() })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} onScroll={measure} className="h-full overflow-auto">{children}</div>
      {!atTop && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-fg/10 to-transparent" />
      )}
      {!atBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-fg/15 to-transparent" />
      )}
    </div>
  )
}
