import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readState, writeState, listStateIds, deleteState } from '../../src/main/store/state'

describe('state store', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('returns a new state when none exists', async () => {
    const s = await readState(root, 'abc')
    expect(s.state).toBe('New')
    expect(s.reps).toBe(0)
  })

  it('roundtrips a state', async () => {
    const initial = await readState(root, 'abc')
    const updated = { ...initial, reps: 3, state: 'Review' as const, stability: 5 }
    await writeState(root, updated)
    const read = await readState(root, 'abc')
    expect(read.reps).toBe(3)
    expect(read.state).toBe('Review')
  })

  it('lists state ids', async () => {
    await writeState(root, { ...(await readState(root, 'x')), reps: 1 })
    await writeState(root, { ...(await readState(root, 'y')), reps: 1 })
    const ids = await listStateIds(root)
    expect(ids.sort()).toEqual(['x', 'y'])
  })

  it('deletes a state', async () => {
    await writeState(root, { ...(await readState(root, 'z')), reps: 1 })
    await deleteState(root, 'z')
    expect(await listStateIds(root)).not.toContain('z')
  })
})
