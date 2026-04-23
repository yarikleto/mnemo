import { promises as fs } from 'node:fs'
import { ConfigSchema, DEFAULT_CONFIG, type Config } from '../../shared/schema'
import { atomicWrite } from '../atomic-write'

export async function loadConfig(configFile: string, fallbackRootPath: string): Promise<Config> {
  try {
    const raw = await fs.readFile(configFile, 'utf8')
    return ConfigSchema.parse(JSON.parse(raw))
  } catch {
    const cfg: Config = { rootPath: fallbackRootPath, ...DEFAULT_CONFIG }
    await atomicWrite(configFile, JSON.stringify(cfg, null, 2))
    return cfg
  }
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
    fsrs: patch.fsrs ? { ...current.fsrs, ...patch.fsrs } : current.fsrs
  }
  return saveConfig(configFile, merged)
}
