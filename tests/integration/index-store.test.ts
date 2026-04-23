import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CardIndex } from '../../src/main/store/index'
import { createCardOnDisk } from '../../src/main/store/cards'

describe('CardIndex', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'idx-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('builds from a directory of cards', async () => {
    await createCardOnDisk(root, { namespace: 'a', question: 'Q1', body: 'B1' })
    await createCardOnDisk(root, { namespace: 'a/b', question: 'Q2', body: 'B2' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    expect(idx.all()).toHaveLength(2)
  })

  it('upsert and removeById', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q', body: 'B' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    expect(idx.get(c.id)).toBeDefined()
    idx.removeById(c.id)
    expect(idx.get(c.id)).toBeUndefined()
  })
})
