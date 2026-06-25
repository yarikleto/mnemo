import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'

const electronMock = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>()
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: unknown, raw: unknown) => Promise<unknown>) => {
      handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel)
    })
  }
  return { handlers, ipcMain }
})

vi.mock('electron', () => ({
  ipcMain: electronMock.ipcMain
}))

import { createIpcScope, VOID } from '../../src/main/ipc/lifecycle'

describe('IPC lifecycle helper', () => {
  beforeEach(() => {
    electronMock.handlers.clear()
    electronMock.ipcMain.handle.mockClear()
    electronMock.ipcMain.removeHandler.mockClear()
  })

  it('wraps successful handlers in ApiResult', async () => {
    const ipc = createIpcScope()
    ipc.handle('double', z.object({ value: z.number() }), ({ value }) => value * 2)

    const handler = electronMock.handlers.get('double')
    expect(handler).toBeDefined()
    await expect(handler!(null, { value: 21 })).resolves.toEqual({ ok: true, data: 42 })
  })

  it('returns ApiResult errors for invalid input before calling the handler', async () => {
    const ipc = createIpcScope()
    const fn = vi.fn()
    ipc.handle('validated', z.object({ value: z.number() }), fn)

    const result = await electronMock.handlers.get('validated')!(null, { value: 'nope' })
    expect(result).toMatchObject({ ok: false })
    expect(fn).not.toHaveBeenCalled()
  })

  it('tracks registered channels for disposal', () => {
    const ipc = createIpcScope()
    ipc.handle('one', VOID, () => undefined)
    ipc.handle('two', z.string(), () => undefined)

    ipc.dispose()

    expect(electronMock.ipcMain.removeHandler).toHaveBeenCalledWith('one')
    expect(electronMock.ipcMain.removeHandler).toHaveBeenCalledWith('two')
    expect(electronMock.handlers.size).toBe(0)
  })
})
