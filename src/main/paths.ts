import path from 'node:path'
import { app } from 'electron'

export function defaultRootPath(): string {
  return path.join(app.getPath('documents'), 'interview-prep')
}

export function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function cardsDir(rootPath: string): string {
  return path.join(rootPath, 'cards')
}

export function stateDir(rootPath: string): string {
  return path.join(rootPath, 'state')
}

export function stateFile(rootPath: string, id: string): string {
  return path.join(stateDir(rootPath), `${id}.json`)
}

export function namespaceFromPath(rootPath: string, absPath: string): string {
  const rel = path.relative(cardsDir(rootPath), absPath)
  const dir = path.dirname(rel)
  return dir === '.' ? '' : dir.split(path.sep).join('/')
}
