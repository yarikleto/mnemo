import { promises as fs } from 'node:fs'
import { stateFile, stateDir } from '../paths'
import { atomicWrite } from '../atomic-write'
import { ReviewStateSchema, type ReviewState } from '../../shared/schema'

export function newState(id: string): ReviewState {
  return {
    id,
    due: '1970-01-01T00:00:00.000Z',
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_review: null,
    history: []
  }
}

export async function readState(rootPath: string, id: string): Promise<ReviewState> {
  try {
    const raw = await fs.readFile(stateFile(rootPath, id), 'utf8')
    return ReviewStateSchema.parse(JSON.parse(raw))
  } catch {
    return newState(id)
  }
}

export async function writeState(rootPath: string, state: ReviewState): Promise<void> {
  const validated = ReviewStateSchema.parse(state)
  await atomicWrite(stateFile(rootPath, state.id), JSON.stringify(validated, null, 2))
}

export async function listStateIds(rootPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(stateDir(rootPath))
    return entries.filter(e => e.endsWith('.json')).map(e => e.replace(/\.json$/, ''))
  } catch {
    return []
  }
}

export async function deleteState(rootPath: string, id: string): Promise<void> {
  try {
    await fs.unlink(stateFile(rootPath, id))
  } catch {
    /* idempotent */
  }
}
