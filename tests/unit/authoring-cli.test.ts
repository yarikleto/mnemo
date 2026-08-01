import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseCardFile } from '../../src/main/markdown/parse'

const run = promisify(execFile)
const CLI = path.resolve(__dirname, '../../tools/authoring/create-card.mjs')

// tools/authoring/create-card.mjs carries its own copy of the card serializer
// (it runs standalone, outside the app bundle). These tests pin it to the same
// contract as src/main/markdown/parse.ts — the two drifting apart is exactly how
// the block-scalar corruption reached the card-researcher path.
describe('create-card CLI', () => {
  let root: string

  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'mnemo-cli-')) })
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

  const create = (args: string[]) => run('node', [CLI, '--root', root, ...args])

  const onlyCard = async (): Promise<string> => {
    const dir = path.join(root, 'cards', 'deck')
    const [file] = await fs.readdir(dir)
    return fs.readFile(path.join(dir, file!), 'utf8')
  }

  it('writes a card whose prompt starts with an indented line and reads it back', async () => {
    const text = '  def cache(key):\n      return store[key]\nprint(cache("a"))'
    await create(['--namespace', 'deck', '--prompt', text, '--body', 'An answer'])

    const parsed = parseCardFile(await onlyCard())
    expect(parsed.frontmatter.prompts[0]!.text).toBe(text)
    expect(parsed.body.trim()).toBe('An answer')
  })

  it('roundtrips multiple prompt variants', async () => {
    await create([
      '--namespace', 'deck',
      '--prompt', 'What is it?',
      '--prompt', 'Mechanism:\n  step one\nstep two',
      '--tags', 'a, b',
      '--body', 'Answer'
    ])

    const { frontmatter } = parseCardFile(await onlyCard())
    expect(frontmatter.prompts.map(p => p.text)).toEqual([
      'What is it?',
      'Mechanism:\n  step one\nstep two'
    ])
    expect(frontmatter.tags).toEqual(['a', 'b'])
  })

  it('refuses a blank prompt rather than writing an unreadable card', async () => {
    await expect(create(['--namespace', 'deck', '--prompt', '   ', '--body', 'x']))
      .rejects.toThrow(/--prompt cannot be blank/)
    await expect(fs.readdir(path.join(root, 'cards', 'deck'))).rejects.toThrow()
  })
})
