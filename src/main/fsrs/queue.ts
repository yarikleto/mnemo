import { readState } from '../store/state'
import type { CardIndex } from '../store/index'
import type { DueCard } from '../../shared/api'

export async function buildDueQueue(
  rootPath: string,
  index: CardIndex,
  opts: { namespaces?: string[]; now?: Date } = {}
): Promise<DueCard[]> {
  const now = (opts.now ?? new Date()).getTime()
  const wantedPrefixes = opts.namespaces?.length ? opts.namespaces : null
  const result: Array<{ entry: DueCard; due: number }> = []
  for (const card of index.all()) {
    if (wantedPrefixes && !wantedPrefixes.some(p => card.namespace === p || card.namespace.startsWith(p + '/'))) continue
    const st = await readState(rootPath, card.id)
    const due = new Date(st.due).getTime()
    if (due <= now) result.push({
      entry: { cardId: card.id, namespace: card.namespace, tags: card.tags },
      due
    })
  }
  return result.sort((a, b) => a.due - b.due).map(r => r.entry)
}
