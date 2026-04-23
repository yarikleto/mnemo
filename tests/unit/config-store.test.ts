import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadConfig, saveConfig, patchConfig } from '../../src/main/store/config'

describe('config store', () => {
  let dir: string
  let file: string
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfg-'))
    file = path.join(dir, 'config.json')
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('creates a default config when file is missing', async () => {
    const cfg = await loadConfig(file, '/tmp/data')
    expect(cfg.rootPath).toBe('/tmp/data')
    expect(cfg.dashboard.widgets).toHaveLength(6)
    const disk = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(disk.rootPath).toBe('/tmp/data')
  })

  it('loads an existing config', async () => {
    await loadConfig(file, '/tmp/a')
    const cfg = await loadConfig(file, '/ignored')
    expect(cfg.rootPath).toBe('/tmp/a')
  })

  it('patches theme without losing other fields', async () => {
    const cfg = await loadConfig(file, '/tmp/a')
    const updated = await patchConfig(file, cfg, { theme: 'dark' })
    expect(updated.theme).toBe('dark')
    expect(updated.dashboard.widgets).toHaveLength(6)
  })
})
