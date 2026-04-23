import { shell } from 'electron'
import { spawn } from 'node:child_process'

export async function openInExternalEditor(absPath: string, override: string | null): Promise<void> {
  if (override) {
    spawn(override, [absPath], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  await shell.openPath(absPath)
}
