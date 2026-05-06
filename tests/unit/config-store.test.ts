import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadConfig, saveConfig, patchConfig } from '../../src/main/store/config'

void saveConfig

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

  it('creates a default config with empty rootPath sentinel when file is missing', async () => {
    const cfg = await loadConfig(file, '/tmp/data')
    expect(cfg.rootPath).toBe('')
    expect(cfg.onboardedAt).toBeNull()
    expect(cfg.dashboard.widgets).toHaveLength(6)
    expect(cfg.autoUpdate.enabled).toBe(true)
    const disk = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(disk.rootPath).toBe('')
    expect(disk.onboardedAt).toBeNull()
  })

  it('loads an existing config and ignores the fallback', async () => {
    await loadConfig(file, '/tmp/a')
    const cfg = await loadConfig(file, '/ignored')
    expect(cfg.rootPath).toBe('')
  })

  it('migrates a pre-v1 config (onboardedAt missing, cards/ exists) by stamping onboardedAt', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-'))
    await fs.mkdir(path.join(vault, 'cards'), { recursive: true })
    // Write a pre-v1 config — no onboardedAt field, real rootPath.
    const preV1 = {
      rootPath: vault,
      theme: 'system',
      dashboard: { widgets: [
        { id: 'due-forecast', enabled: true, order: 0 },
        { id: 'namespace-ranking', enabled: true, order: 1 },
        { id: 'leech-list', enabled: true, order: 2 },
        { id: 'heatmap', enabled: false, order: 3 },
        { id: 'activity-streak', enabled: false, order: 4 },
        { id: 'key-stats', enabled: false, order: 5 }
      ] },
      fsrs: { desiredRetention: 0.9, maximumInterval: 365 },
      externalEditor: null
    }
    await fs.writeFile(file, JSON.stringify(preV1))
    const cfg = await loadConfig(file, '/tmp/whatever')
    expect(cfg.rootPath).toBe(vault)
    expect(cfg.onboardedAt).not.toBeNull()
    // Re-loading should be idempotent — same timestamp persists.
    const reloaded = await loadConfig(file, '/tmp/whatever')
    expect(reloaded.onboardedAt).toBe(cfg.onboardedAt)
    await fs.rm(vault, { recursive: true, force: true })
  })

  it('does NOT migrate when rootPath is set but cards/ is missing', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-'))
    const preV1 = {
      rootPath: vault,
      theme: 'system',
      dashboard: { widgets: [
        { id: 'due-forecast', enabled: true, order: 0 },
        { id: 'namespace-ranking', enabled: true, order: 1 },
        { id: 'leech-list', enabled: true, order: 2 },
        { id: 'heatmap', enabled: false, order: 3 },
        { id: 'activity-streak', enabled: false, order: 4 },
        { id: 'key-stats', enabled: false, order: 5 }
      ] },
      fsrs: { desiredRetention: 0.9, maximumInterval: 365 },
      externalEditor: null
    }
    await fs.writeFile(file, JSON.stringify(preV1))
    const cfg = await loadConfig(file, '/tmp/whatever')
    expect(cfg.onboardedAt).toBeNull()
    await fs.rm(vault, { recursive: true, force: true })
  })

  it('patches theme without losing other fields', async () => {
    const cfg = await loadConfig(file, '/tmp/a')
    const updated = await patchConfig(file, cfg, { theme: 'dark' })
    expect(updated.theme).toBe('dark')
    expect(updated.dashboard.widgets).toHaveLength(6)
  })

  it('patches autoUpdate.enabled without losing other fields', async () => {
    const cfg = await loadConfig(file, '/tmp/a')
    const updated = await patchConfig(file, cfg, { autoUpdate: { enabled: false } })
    expect(updated.autoUpdate.enabled).toBe(false)
    expect(updated.theme).toBe(cfg.theme)
  })
})
