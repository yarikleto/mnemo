import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createCardOnDisk } from '../../src/main/store/cards'
import { writeState, readState } from '../../src/main/store/state'
import { CardIndex } from '../../src/main/store/index'
import { buildDueQueue } from '../../src/main/fsrs/queue'

describe('buildDueQueue', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'q-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('includes cards whose due is in the past', async () => {
    const c1 = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q1'], body: 'B' })
    const c2 = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q2'], body: 'B' })
    await writeState(root, { ...(await readState(root, c1.id)), due: '2020-01-01T00:00:00.000Z' })
    await writeState(root, { ...(await readState(root, c2.id)), due: '2099-01-01T00:00:00.000Z' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    const q = await buildDueQueue(root, idx, { now: new Date('2026-04-23T00:00:00Z') })
    const ids = q.map(c => c.cardId)
    expect(ids).toContain(c1.id)
    expect(ids).not.toContain(c2.id)
  })

  it('filters by namespace prefix', async () => {
    const c1 = await createCardOnDisk(root, { namespace: 'system-design/caching', prompts: ['Q1'], body: 'B' })
    const c2 = await createCardOnDisk(root, { namespace: 'concurrency', prompts: ['Q2'], body: 'B' })
    await writeState(root, { ...(await readState(root, c1.id)), due: '2020-01-01T00:00:00.000Z' })
    await writeState(root, { ...(await readState(root, c2.id)), due: '2020-01-01T00:00:00.000Z' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    const q = await buildDueQueue(root, idx, { namespaces: ['system-design'], now: new Date() })
    expect(q.map(c => c.cardId)).toEqual([c1.id])
  })

  it('emits exactly one queue entry per card regardless of prompt count', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q-A', 'Q-B', 'Q-C'], body: 'B' })
    await writeState(root, { ...(await readState(root, c.id)), due: '2020-01-01T00:00:00.000Z' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    const q = await buildDueQueue(root, idx, { now: new Date('2026-04-23T00:00:00Z') })
    expect(q).toHaveLength(1)
    expect(q[0]!.cardId).toBe(c.id)
  })
})
