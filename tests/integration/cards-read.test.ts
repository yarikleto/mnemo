import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  walkCardFiles, readCardAtPath, createCardOnDisk,
  updateCardOnDisk, moveCardOnDisk, deleteCardOnDisk
} from '../../src/main/store/cards'

describe('cards store', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cards-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('creates and reads a card with correct namespace', async () => {
    const c = await createCardOnDisk(root, {
      namespace: 'system-design/caching',
      question: 'What is a CDN?',
      body: 'A distributed cache.',
      tags: ['networking']
    })
    expect(c.namespace).toBe('system-design/caching')
    expect(c.question).toBe('What is a CDN?')
    expect(c.tags).toEqual(['networking'])

    const paths = await walkCardFiles(root)
    expect(paths).toHaveLength(1)
    const read = await readCardAtPath(root, paths[0]!)
    expect(read.id).toBe(c.id)
  })

  it('updates question and body', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q1', body: 'B1' })
    await updateCardOnDisk(c.path, { question: 'Q2', body: 'B2' })
    const read = await readCardAtPath(root, c.path)
    expect(read.question).toBe('Q2')
    expect(read.body.trim()).toBe('B2')
  })

  it('moves a card to a new namespace preserving id', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q', body: 'B' })
    const newPath = await moveCardOnDisk(root, c.path, 'b/nested')
    const read = await readCardAtPath(root, newPath)
    expect(read.id).toBe(c.id)
    expect(read.namespace).toBe('b/nested')
  })

  it('deletes a card', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q', body: 'B' })
    await deleteCardOnDisk(c.path)
    const paths = await walkCardFiles(root)
    expect(paths).toHaveLength(0)
  })
})
