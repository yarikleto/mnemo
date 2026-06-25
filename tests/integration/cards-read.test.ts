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
      prompts: ['What is a CDN?'],
      body: 'A distributed cache.',
      tags: ['networking']
    })
    expect(c.namespace).toBe('system-design/caching')
    expect(c.prompts).toHaveLength(1)
    expect(c.prompts[0]!.text).toBe('What is a CDN?')
    expect(c.tags).toEqual(['networking'])

    const paths = await walkCardFiles(root)
    expect(paths).toHaveLength(1)
    const read = await readCardAtPath(root, paths[0]!)
    expect(read.id).toBe(c.id)
  })

  it('updates prompts and body', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q1'], body: 'B1' })
    await updateCardOnDisk(c.path, {
      prompts: [{ id: c.prompts[0]!.id, text: 'Q2' }],
      body: 'B2'
    })
    const read = await readCardAtPath(root, c.path)
    expect(read.prompts[0]!.text).toBe('Q2')
    expect(read.prompts[0]!.id).toBe(c.prompts[0]!.id)
    expect(read.body.trim()).toBe('B2')
  })

  it('moves a card to a new namespace preserving id', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q'], body: 'B' })
    const newPath = await moveCardOnDisk(root, c.path, 'b/nested')
    const read = await readCardAtPath(root, newPath)
    expect(read.id).toBe(c.id)
    expect(read.namespace).toBe('b/nested')
  })

  it('moves to a unique filename instead of overwriting an existing basename', async () => {
    const moving = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q'], body: 'Moving body' })
    const existing = await createCardOnDisk(root, { namespace: 'b/nested', prompts: ['Q'], body: 'Existing body' })
    expect(path.basename(moving.path)).toBe(path.basename(existing.path))

    const newPath = await moveCardOnDisk(root, moving.path, 'b/nested')

    expect(newPath).not.toBe(existing.path)
    await expect(fs.access(moving.path)).rejects.toThrow()
    const moved = await readCardAtPath(root, newPath)
    const preserved = await readCardAtPath(root, existing.path)
    expect(moved.id).toBe(moving.id)
    expect(moved.body.trim()).toBe('Moving body')
    expect(preserved.id).toBe(existing.id)
    expect(preserved.body.trim()).toBe('Existing body')
  })

  it('deletes a card', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', prompts: ['Q'], body: 'B' })
    await deleteCardOnDisk(c.path)
    const paths = await walkCardFiles(root)
    expect(paths).toHaveLength(0)
  })
})
