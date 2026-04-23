import chokidar from 'chokidar'
import { EventEmitter } from 'node:events'
import { cardsDir, namespaceFromPath } from './paths'
import { readCardAtPath } from './store/cards'
import type { CardIndex } from './store/index'

export type WatcherEvents = {
  'card-added': string
  'card-changed': string
  'card-removed': string
}

export class Watcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher
  private suppressed = new Map<string, { mtime: number; hash: string }>()

  constructor(private rootPath: string, private index: CardIndex) { super() }

  start() {
    this.watcher = chokidar.watch(cardsDir(this.rootPath), {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
    })
    this.watcher.on('add', p => this.handleChange(p, 'add'))
    this.watcher.on('change', p => this.handleChange(p, 'change'))
    this.watcher.on('unlink', p => this.handleRemove(p))
  }

  suppressNext(path: string, mtime: number, hash: string) {
    this.suppressed.set(path, { mtime, hash })
  }

  async stop() { await this.watcher?.close() }

  private async handleChange(absPath: string, kind: 'add' | 'change') {
    if (!absPath.endsWith('.md')) return
    try {
      const full = await readCardAtPath(this.rootPath, absPath)
      const s = this.suppressed.get(absPath)
      if (s && s.mtime === full.mtime && s.hash === full.bodyHash) {
        this.suppressed.delete(absPath)
        return
      }
      const { body, ...meta } = full
      void body
      const prev = this.index.getByPath(absPath)
      this.index.upsert(meta)
      if (kind === 'add' || !prev) this.emit('card-added', meta.id)
      else this.emit('card-changed', meta.id)
    } catch (_err) {
      // corrupt frontmatter; ignore until fixed
    }
  }

  private handleRemove(absPath: string) {
    if (!absPath.endsWith('.md')) return
    const id = this.index.removeByPath(absPath)
    if (id) this.emit('card-removed', id)
    void namespaceFromPath
  }
}
