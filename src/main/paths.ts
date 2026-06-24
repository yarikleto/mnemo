import path from 'node:path'

export function defaultRootPath(userDataPath: string): string {
  return path.join(userDataPath, 'vault')
}

export function configPath(userDataPath: string): string {
  return path.join(userDataPath, 'config.json')
}

export function cardsDir(rootPath: string): string {
  return path.join(rootPath, 'cards')
}

export function stateDir(rootPath: string): string {
  return path.join(rootPath, 'state')
}

export function stateFile(rootPath: string, id: string): string {
  const dir = stateDir(rootPath)
  const file = path.join(dir, `${id}.json`)
  const rel = path.relative(dir, file)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Unsafe state file id: ${id}`)
  }
  return file
}

export function namespaceFromPath(rootPath: string, absPath: string): string {
  const rel = path.relative(cardsDir(rootPath), absPath)
  const dir = path.dirname(rel)
  return dir === '.' ? '' : dir.split(path.sep).join('/')
}
