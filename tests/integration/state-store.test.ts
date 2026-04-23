import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readState, writeState, listStateIds, deleteState } from '../../src/main/store/state'

// Valid 26-char Crockford Base32 ULIDs used as fixtures
const ID_ABC = '01KPXRNEDBCDJMEJNG622WTDJW'
const ID_X   = '01KPXRNEDCXTKDDKFWQYJ9JA73'
const ID_Y   = '01KPXRNEDC2R7D179WK9ESYHFX'
const ID_Z   = '01KPXRNEDCSCZYP8JC53JK32QG'

describe('state store', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('returns a new state when none exists', async () => {
    const s = await readState(root, ID_ABC)
    expect(s.state).toBe('New')
    expect(s.reps).toBe(0)
  })

  it('roundtrips a state', async () => {
    const initial = await readState(root, ID_ABC)
    const updated = { ...initial, reps: 3, state: 'Review' as const, stability: 5 }
    await writeState(root, updated)
    const read = await readState(root, ID_ABC)
    expect(read.reps).toBe(3)
    expect(read.state).toBe('Review')
  })

  it('lists state ids', async () => {
    await writeState(root, { ...(await readState(root, ID_X)), reps: 1 })
    await writeState(root, { ...(await readState(root, ID_Y)), reps: 1 })
    const ids = await listStateIds(root)
    expect(ids.sort()).toEqual([ID_X, ID_Y].sort())
  })

  it('deletes a state', async () => {
    await writeState(root, { ...(await readState(root, ID_Z)), reps: 1 })
    await deleteState(root, ID_Z)
    expect(await listStateIds(root)).not.toContain(ID_Z)
  })
})
