import { describe, it, expect } from 'vitest'
import { clampToGeometry, type DesktopGeometry, type WindowState } from '../../src/main/window-state'

const primary = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }
const secondary = { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1440 } }

const dualMonitor: DesktopGeometry = { displays: [primary, secondary], primaryId: 1 }
const onlyPrimary: DesktopGeometry = { displays: [primary], primaryId: 1 }

const saved = (overrides: Partial<WindowState> = {}): WindowState => ({
  bounds: { x: 100, y: 100, width: 1280, height: 800 },
  maximized: false,
  fullscreen: false,
  displayId: 1,
  ...overrides
})

describe('clampToGeometry', () => {
  it('returns saved bounds unchanged when they fit on the saved display', () => {
    const out = clampToGeometry(saved(), dualMonitor)
    expect(out.bounds).toEqual({ x: 100, y: 100, width: 1280, height: 800 })
  })

  it('falls back to primary display when the saved display is no longer attached', () => {
    const out = clampToGeometry(saved({ displayId: 2, bounds: { x: 2000, y: 100, width: 1280, height: 800 } }), onlyPrimary)
    // x=2000 was inside the disconnected secondary; primary maxes out at 1920 → window centered.
    expect(out.bounds.x).toBeGreaterThanOrEqual(0)
    expect(out.bounds.x + out.bounds.width).toBeLessThanOrEqual(primary.workArea.width)
  })

  it('clamps an oversized 4K window down to a 1080p panel', () => {
    const out = clampToGeometry(saved({ bounds: { x: 0, y: 0, width: 3840, height: 2160 } }), onlyPrimary)
    expect(out.bounds.width).toBe(1920)
    expect(out.bounds.height).toBe(1080)
  })

  it('preserves maximized + fullscreen flags through the clamp', () => {
    const out = clampToGeometry(saved({ maximized: true, fullscreen: false }), dualMonitor)
    expect(out.maximized).toBe(true)
    expect(out.fullscreen).toBe(false)
  })

  it('centers the window when the saved origin is outside the chosen display', () => {
    // Saved off-screen origin on a single display.
    const out = clampToGeometry(saved({ bounds: { x: -500, y: -500, width: 1280, height: 800 } }), onlyPrimary)
    expect(out.bounds.x).toBeGreaterThanOrEqual(0)
    expect(out.bounds.y).toBeGreaterThanOrEqual(0)
  })
})
