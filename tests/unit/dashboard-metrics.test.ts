import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const electronMock = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>()
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (event: unknown, raw: unknown) => Promise<unknown>) => {
        handlers.set(channel, handler)
      }),
      removeHandler: vi.fn((channel: string) => { handlers.delete(channel) })
    },
    app: { getPath: vi.fn(() => '/tmp/mnemo-test-user-data'), getVersion: vi.fn(() => '0.0.0-test') },
    shell: { openPath: vi.fn() }
  }
})

vi.mock('electron', () => ({
  app: electronMock.app,
  shell: electronMock.shell,
  ipcMain: electronMock.ipcMain,
  BrowserWindow: class {}
}))

import { registerIpc } from '../../src/main/ipc/register'
import { createCardOnDisk } from '../../src/main/store/cards'
import { CardIndex } from '../../src/main/store/index'
import { writeState, newState } from '../../src/main/store/state'
import { DEFAULT_CONFIG, type Config, type ReviewState } from '../../src/shared/schema'
import type { DashboardData } from '../../src/shared/api'
import type { Rating } from '../../src/shared/constants'

const DAY = 86_400_000

/** Midday local time, `offset` days from today — keeps assertions clear of DST edges. */
function localDaysFromNow(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(12, 0, 0, 0)
  return d
}

function reviewed(id: string, ratings: Rating[], due: Date, at: Date[] = []): ReviewState {
  return {
    ...newState(id),
    due: due.toISOString(),
    reps: ratings.length,
    stability: 10,
    state: 'Review',
    last_review: (at.at(-1) ?? new Date()).toISOString(),
    history: ratings.map((rating, i) => ({
      ts: (at[i] ?? new Date()).toISOString(),
      rating,
      elapsed_days: 1
    }))
  }
}

describe('dashboard metrics', () => {
  let root: string
  let index: CardIndex
  let dispose: () => void

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'mnemo-dashboard-'))
    electronMock.handlers.clear()
    index = new CardIndex()
  })

  afterEach(async () => {
    dispose?.()
    await fs.rm(root, { recursive: true, force: true })
  })

  const start = async () => {
    await index.buildFrom(root)
    dispose = registerIpc(makeCtx(root, index))
  }

  const dashboard = async (widgets: string[]): Promise<DashboardData> => {
    const res = await electronMock.handlers.get('getDashboardData')!(null, widgets) as
      { ok: true; data: DashboardData } | { ok: false; error: string }
    if (!res.ok) throw new Error(res.error)
    return res.data
  }

  // Regression: unreviewed cards scored 0% retention, so a brand-new deck was
  // ranked as the weakest one and the library read "0% retention".
  it('excludes never-reviewed cards from retention rather than scoring them 0%', async () => {
    const strong = await createCardOnDisk(root, { namespace: 'known', prompts: ['Q1?'], body: 'A' })
    for (let i = 0; i < 9; i++) {
      await createCardOnDisk(root, { namespace: 'known', prompts: [`New ${i}?`], body: 'A' })
    }
    await createCardOnDisk(root, { namespace: 'untouched', prompts: ['Q2?'], body: 'A' })
    await writeState(root, reviewed(strong.id, ['Good', 'Good', 'Good', 'Good'], localDaysFromNow(3)))
    await start()

    const data = await dashboard(['namespace-ranking', 'key-stats', 'heatmap'])

    expect(data.namespaceRanking).toEqual([{ namespace: 'known', retention: 1, count: 10 }])
    expect(data.keyStats!.total).toBe(11)
    expect(data.keyStats!.retention).toBe(1)
    expect(data.heatmap!.filter(c => c.retention === null)).toHaveLength(10)
  })

  it('reports null retention when nothing has been reviewed yet', async () => {
    await createCardOnDisk(root, { namespace: 'a', prompts: ['Q?'], body: 'A' })
    await start()

    const data = await dashboard(['key-stats', 'namespace-ranking'])

    expect(data.keyStats!.retention).toBeNull()
    expect(data.namespaceRanking).toEqual([])
  })

  it('averages retention over reviewed cards only', async () => {
    const a = await createCardOnDisk(root, { namespace: 'd', prompts: ['A?'], body: 'x' })
    const b = await createCardOnDisk(root, { namespace: 'd', prompts: ['B?'], body: 'x' })
    await createCardOnDisk(root, { namespace: 'd', prompts: ['C?'], body: 'x' })
    await writeState(root, reviewed(a.id, ['Good', 'Good'], localDaysFromNow(2)))
    await writeState(root, reviewed(b.id, ['Again', 'Good'], localDaysFromNow(2)))
    await start()

    const data = await dashboard(['namespace-ranking'])

    // 100% and 50%, averaged over the two reviewed cards; count reports all three.
    expect(data.namespaceRanking).toEqual([{ namespace: 'd', retention: 0.75, count: 3 }])
  })

  // Regression: buckets were rolling 24h windows while the widget labels them
  // "+1 … +7", so a card due tomorrow at 23:00 landed in +2.
  it('buckets the forecast by local calendar day', async () => {
    const overdue = await createCardOnDisk(root, { namespace: 'f', prompts: ['1?'], body: 'x' })
    const laterToday = await createCardOnDisk(root, { namespace: 'f', prompts: ['2?'], body: 'x' })
    const tomorrowLate = await createCardOnDisk(root, { namespace: 'f', prompts: ['3?'], body: 'x' })
    const inSeven = await createCardOnDisk(root, { namespace: 'f', prompts: ['4?'], body: 'x' })
    const beyond = await createCardOnDisk(root, { namespace: 'f', prompts: ['5?'], body: 'x' })

    const endOfTomorrow = localDaysFromNow(1)
    endOfTomorrow.setHours(23, 30, 0, 0)
    const today = new Date()
    today.setHours(23, 59, 0, 0)

    await writeState(root, reviewed(overdue.id, ['Good'], new Date(Date.now() - DAY)))
    await writeState(root, reviewed(laterToday.id, ['Good'], today))
    await writeState(root, reviewed(tomorrowLate.id, ['Good'], endOfTomorrow))
    await writeState(root, reviewed(inSeven.id, ['Good'], localDaysFromNow(7)))
    await writeState(root, reviewed(beyond.id, ['Good'], localDaysFromNow(9)))
    await start()

    const { dueForecast } = await dashboard(['due-forecast'])

    expect(dueForecast!.today).toBe(2)
    expect(dueForecast!.next7Days[0]).toBe(1)
    expect(dueForecast!.next7Days[6]).toBe(1)
    expect(dueForecast!.next7Days.reduce((a, b) => a + b, 0)).toBe(2)
  })

  // Regression: an as-yet-unreviewed today reset the streak to 0 every morning,
  // and day keys came from the UTC ISO prefix rather than the user's calendar.
  it('keeps the streak alive while today is still in progress', async () => {
    const card = await createCardOnDisk(root, { namespace: 's', prompts: ['Q?'], body: 'x' })
    await writeState(root, reviewed(
      card.id,
      ['Good', 'Good', 'Good'],
      localDaysFromNow(1),
      [localDaysFromNow(-3), localDaysFromNow(-2), localDaysFromNow(-1)]
    ))
    await start()

    const { activityStreak } = await dashboard(['activity-streak'])

    expect(activityStreak!.currentStreak).toBe(3)
    expect(activityStreak!.total).toBe(3)
    expect(activityStreak!.days).toHaveLength(90)
    expect(activityStreak!.days.at(-1)!.count).toBe(0)
    expect(activityStreak!.days.at(-2)!.count).toBe(1)
  })

  it('breaks the streak on a missed day that is not today', async () => {
    const card = await createCardOnDisk(root, { namespace: 's', prompts: ['Q?'], body: 'x' })
    await writeState(root, reviewed(
      card.id,
      ['Good', 'Good'],
      localDaysFromNow(1),
      [localDaysFromNow(-5), localDaysFromNow(-1)]
    ))
    await start()

    const { activityStreak } = await dashboard(['activity-streak'])

    expect(activityStreak!.currentStreak).toBe(1)
  })
})

function makeCtx(root: string, index: CardIndex): Parameters<typeof registerIpc>[0] {
  const config: Config = { rootPath: root, ...DEFAULT_CONFIG }
  return {
    getConfig: () => config,
    setConfig: vi.fn(),
    index,
    watcher: { on: vi.fn(), off: vi.fn(), suppressNext: vi.fn(), relocate: vi.fn() },
    win: { webContents: { send: vi.fn() } }
  } as unknown as Parameters<typeof registerIpc>[0]
}
