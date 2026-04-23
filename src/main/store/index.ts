import { walkCardFiles, readCardAtPath } from './cards'
import type { CardMeta } from '../../shared/schema'

export class CardIndex {
  private byId = new Map<string, CardMeta>()
  private byPath = new Map<string, string>() // path → id

  async buildFrom(rootPath: string): Promise<void> {
    this.byId.clear()
    this.byPath.clear()
    const paths = await walkCardFiles(rootPath)
    for (const p of paths) {
      try {
        const full = await readCardAtPath(rootPath, p)
        const { body, ...meta } = full
        void body
        this.byId.set(meta.id, meta)
        this.byPath.set(meta.path, meta.id)
      } catch (_err) {
        // corrupt frontmatter — skip (surfaced via rescan diagnostics in future)
      }
    }
  }

  get(id: string): CardMeta | undefined { return this.byId.get(id) }
  getByPath(p: string): CardMeta | undefined {
    const id = this.byPath.get(p)
    return id ? this.byId.get(id) : undefined
  }
  all(): CardMeta[] { return Array.from(this.byId.values()) }
  allIds(): string[] { return Array.from(this.byId.keys()) }
  upsert(meta: CardMeta): void {
    const prev = this.byId.get(meta.id)
    if (prev && prev.path !== meta.path) this.byPath.delete(prev.path)
    this.byId.set(meta.id, meta)
    this.byPath.set(meta.path, meta.id)
  }
  removeById(id: string): void {
    const meta = this.byId.get(id)
    if (meta) this.byPath.delete(meta.path)
    this.byId.delete(id)
  }
  removeByPath(p: string): string | undefined {
    const id = this.byPath.get(p)
    if (id) { this.byId.delete(id); this.byPath.delete(p) }
    return id
  }
}
