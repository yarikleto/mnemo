import { readState } from '../store/state'
import { mapWithConcurrency } from '../concurrency'
import type { CardIndex } from '../store/index'
import type { DueCard } from '../../shared/api'

export async function buildDueQueue(
  rootPath: string,
  index: CardIndex,
  opts: { namespaces?: string[]; now?: Date } = {}
): Promise<DueCard[]> {
  const now = (opts.now ?? new Date()).getTime()
  const wantedPrefixes = opts.namespaces?.length ? opts.namespaces : null
  const cards = index.all().filter(card =>
    !wantedPrefixes || wantedPrefixes.some(p => card.namespace === p || card.namespace.startsWith(p + '/'))
  )
  // One state file per card. Reading them serially made the sidebar's namespace
  // refresh — which fires on every rating — an O(n) chain of round trips.
  const rows = await mapWithConcurrency(cards, async card => {
    const st = await readState(rootPath, card.id)
    return { card, due: new Date(st.due).getTime() }
  })
  return rows
    .filter(r => r.due <= now)
    .sort((a, b) => a.due - b.due)
    .map(r => ({ cardId: r.card.id, namespace: r.card.namespace, tags: r.card.tags }))
}
