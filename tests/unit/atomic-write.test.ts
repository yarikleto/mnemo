import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { atomicWrite, hashBody } from '../../src/main/atomic-write'

describe('atomicWrite', () => {
  let tmp: string
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-'))
  })
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('writes contents to disk', async () => {
    const f = path.join(tmp, 'sub', 'out.txt')
    await atomicWrite(f, 'hello')
    expect(await fs.readFile(f, 'utf8')).toBe('hello')
  })

  it('leaves no .tmp files behind', async () => {
    const f = path.join(tmp, 'out.txt')
    await atomicWrite(f, 'x')
    const entries = await fs.readdir(tmp)
    expect(entries.every(e => !e.endsWith('.tmp'))).toBe(true)
  })

  it('overwrites existing file', async () => {
    const f = path.join(tmp, 'out.txt')
    await atomicWrite(f, 'first')
    await atomicWrite(f, 'second')
    expect(await fs.readFile(f, 'utf8')).toBe('second')
  })
})

describe('hashBody', () => {
  it('is deterministic', () => {
    expect(hashBody('abc')).toBe(hashBody('abc'))
  })
  it('differs for different inputs', () => {
    expect(hashBody('a')).not.toBe(hashBody('b'))
  })
})
