import { shell } from 'electron'
import { spawn } from 'node:child_process'

export async function openInExternalEditor(absPath: string, override: string | null): Promise<void> {
  if (override) {
    // spawn() reports a missing binary asynchronously via an 'error' event. With
    // no listener attached that event is re-thrown as an uncaught exception and
    // takes the main process down, so a typo in the External editor setting
    // would crash the app. Resolve on 'spawn', reject with a readable message.
    await new Promise<void>((resolve, reject) => {
      const child = spawn(override, [absPath], { detached: true, stdio: 'ignore' })
      child.once('error', (e: NodeJS.ErrnoException) => {
        reject(new Error(
          e.code === 'ENOENT'
            ? `External editor "${override}" was not found on your PATH.`
            : `Could not launch "${override}": ${e.message}`
        ))
      })
      child.once('spawn', () => { child.unref(); resolve() })
    })
    return
  }
  const message = await shell.openPath(absPath)
  if (message) throw new Error(`Could not open card file: ${message}`)
}
