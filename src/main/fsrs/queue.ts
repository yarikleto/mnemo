import { readState } from '../store/state'
import type { CardMeta } from '../../shared/schema'
import type { CardIndex } from '../store/index'

export async function buildDueQueue(
  rootPath: string,
  index: CardIndex,
  opts: { namespaces?: string[]; now?: Date } = {}
): Promise<CardMeta[]> {
  const now = (opts.now ?? new Date()).getTime()
  const wantedPrefixes = opts.namespaces?.length ? opts.namespaces : null
  const result: Array<{ meta: CardMeta; due: number }> = []
  for (const meta of index.all()) {
    if (wantedPrefixes && !wantedPrefixes.some(p => meta.namespace === p || meta.namespace.startsWith(p + '/'))) continue
    const st = await readState(rootPath, meta.id)
    const due = new Date(st.due).getTime()
    if (due <= now) result.push({ meta, due })
  }
  return result.sort((a, b) => a.due - b.due).map(r => r.meta)
}
