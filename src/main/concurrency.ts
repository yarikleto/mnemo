/**
 * Map over `items` with at most `limit` tasks in flight, preserving input order
 * in the result. Used for the per-card `state/<id>.json` reads that back the due
 * queue and the dashboard: those are hundreds of tiny files, and awaiting them
 * one at a time leaves libuv's threadpool idle for most of the walk.
 *
 * The default matches libuv's default UV_THREADPOOL_SIZE — going wider just
 * queues work inside libuv instead of here.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  limit = 8
): Promise<R[]> {
  if (items.length === 0) return []
  const width = Math.max(1, Math.min(limit, items.length))
  const out = new Array<R>(items.length)
  let cursor = 0

  const worker = async (): Promise<void> => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i]!, i)
    }
  }

  await Promise.all(Array.from({ length: width }, worker))
  return out
}
