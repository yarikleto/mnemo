import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ConfigSchema, DEFAULT_CONFIG, type Config } from '../../shared/schema'
import { atomicWrite } from '../atomic-write'

export async function loadConfig(configFile: string, _fallbackRootPath: string): Promise<Config> {
  try {
    const raw = await fs.readFile(configFile, 'utf8')
    const parsed = ConfigSchema.parse(JSON.parse(raw))
    return await migrateConfigIfNeeded(configFile, parsed)
  } catch (e) {
    if (!isNotFoundError(e)) throw e
    // Fresh install — no auto-mkdir of subdirs. rootPath stays the empty
    // sentinel until completeOnboarding creates the managed app-data vault.
    const cfg: Config = { rootPath: '', ...DEFAULT_CONFIG }
    await atomicWrite(configFile, JSON.stringify(cfg, null, 2))
    return cfg
  }
}

// Backward-compat: an existing user upgrading to v1 has a real rootPath in
// their config but no `onboardedAt` field (it didn't exist before). If their
// vault already contains a `cards/` directory, treat them as onboarded and
// silently stamp the timestamp so the maintainer's daily-driver session is
// not interrupted by an onboarding screen on first v1 launch.
async function migrateConfigIfNeeded(configFile: string, cfg: Config): Promise<Config> {
  if (cfg.onboardedAt) return cfg
  if (!cfg.rootPath) return cfg
  try {
    await fs.access(path.join(cfg.rootPath, 'cards'))
  } catch (e) {
    if (!isNotFoundError(e)) throw e
    return cfg
  }
  const next: Config = { ...cfg, onboardedAt: new Date().toISOString() }
  await atomicWrite(configFile, JSON.stringify(next, null, 2))
  return next
}

export async function saveConfig(configFile: string, cfg: Config): Promise<Config> {
  const validated = ConfigSchema.parse(cfg)
  await atomicWrite(configFile, JSON.stringify(validated, null, 2))
  return validated
}

export async function patchConfig(configFile: string, current: Config, patch: Partial<Config>): Promise<Config> {
  const merged = {
    ...current,
    ...patch,
    dashboard: patch.dashboard ?? current.dashboard,
    fsrs: patch.fsrs ? { ...current.fsrs, ...patch.fsrs } : current.fsrs,
    autoUpdate: patch.autoUpdate ? { ...current.autoUpdate, ...patch.autoUpdate } : current.autoUpdate
  }
  return saveConfig(configFile, merged)
}

function isNotFoundError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT'
}
