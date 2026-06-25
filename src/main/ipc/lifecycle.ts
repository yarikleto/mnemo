import { ipcMain } from 'electron'
import { z } from 'zod'
import type { ApiResult } from '../../shared/api'

export type IpcDisposer = () => void

export const VOID = z.undefined().or(z.null()).transform((): void => undefined)

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const err = (e: unknown): ApiResult<never> => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e)
})

export function createIpcScope() {
  const channels = new Set<string>()
  const disposers: IpcDisposer[] = []
  let disposed = false

  const handle = <T, A = void>(
    channel: string,
    schema: z.ZodType<A>,
    fn: (args: A) => Promise<T> | T
  ): void => {
    if (disposed) throw new Error(`IPC scope is already disposed: ${channel}`)
    if (channels.has(channel)) throw new Error(`IPC channel registered twice: ${channel}`)

    ipcMain.handle(channel, async (_event, raw): Promise<ApiResult<T>> => {
      try {
        const args = schema.parse(raw)
        return ok(await fn(args))
      } catch (e) {
        return err(e)
      }
    })
    channels.add(channel)
  }

  const addDisposer = (disposer: IpcDisposer): void => {
    if (disposed) {
      disposer()
      return
    }
    disposers.push(disposer)
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true

    for (let i = disposers.length - 1; i >= 0; i--) {
      disposers[i]!()
    }
    disposers.length = 0

    for (const channel of channels) {
      ipcMain.removeHandler(channel)
    }
    channels.clear()
  }

  return { handle, addDisposer, dispose }
}
