import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export async function atomicWrite(targetPath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.${crypto.randomBytes(6).toString('hex')}.tmp`
  await fs.writeFile(tmp, contents, 'utf8')
  await fs.rename(tmp, targetPath)
}

export function hashBody(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
}
