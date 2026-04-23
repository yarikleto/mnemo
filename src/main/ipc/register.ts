import { ipcMain, BrowserWindow } from 'electron'
import { z } from 'zod'
import { readCardAtPath, createCardOnDisk, updateCardOnDisk, moveCardOnDisk, deleteCardOnDisk } from '../store/cards'
import { readState, writeState, deleteState, listStateIds } from '../store/state'
import { createScheduler, rateCard } from '../fsrs/scheduler'
import { buildDueQueue } from '../fsrs/queue'
import { openInExternalEditor } from '../editor-open'
import { patchConfig } from '../store/config'
import { configPath } from '../paths'
import type { Config } from '../../shared/schema'
import type { ReviewState } from '../../shared/schema'
import type { CardIndex } from '../store/index'
import type { Watcher } from '../watcher'
import type { ApiResult, NamespaceNode, DashboardData } from '../../shared/api'
import type { WidgetId } from '../../shared/constants'
import { RATINGS, WIDGET_IDS } from '../../shared/constants'

type Ctx = {
  getConfig: () => Config
  setConfig: (cfg: Config) => void
  index: CardIndex
  watcher: Watcher
  win: BrowserWindow
}

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const err = (e: unknown): ApiResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) })

function namespacesFromIndex(index: CardIndex, dueCountsByNs: Map<string, number>): NamespaceNode {
  const root: NamespaceNode = { name: '', path: '', dueCount: 0, children: [] }
  for (const meta of index.all()) {
    const parts = meta.namespace ? meta.namespace.split('/') : []
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!
      const nsPath = parts.slice(0, i + 1).join('/')
      let child = cur.children.find(c => c.name === name)
      if (!child) { child = { name, path: nsPath, dueCount: 0, children: [] }; cur.children.push(child) }
      cur = child
    }
  }
  const fillCounts = (n: NamespaceNode): number => {
    let total = dueCountsByNs.get(n.path) ?? 0
    for (const child of n.children) total += fillCounts(child)
    n.dueCount = total
    return total
  }
  fillCounts(root)
  return root
}

export function registerIpc(ctx: Ctx): () => void {
  const h = <T, A = void>(channel: string, schema: z.ZodType<A>, fn: (args: A) => Promise<T> | T) => {
    ipcMain.handle(channel, async (_e, raw) => {
      try {
        const args = schema.parse(raw)
        return ok(await fn(args))
      } catch (e) { return err(e) }
    })
  }
  const VOID = z.undefined().or(z.null()).transform(() => undefined)

  h('listNamespaces', VOID, async () => {
    const rootPath = ctx.getConfig().rootPath
    const counts = new Map<string, number>()
    const due = await buildDueQueue(rootPath, ctx.index)
    for (const m of due) counts.set(m.namespace, (counts.get(m.namespace) ?? 0) + 1)
    return namespacesFromIndex(ctx.index, counts)
  })

  h('listCards', z.string().optional(), async (ns) => {
    return ctx.index.all().filter(m => !ns || m.namespace === ns || m.namespace.startsWith(ns + '/'))
  })

  h('getDueQueue', z.object({ namespaces: z.array(z.string()).optional() }), async (f) => {
    return buildDueQueue(ctx.getConfig().rootPath, ctx.index, { namespaces: f.namespaces })
  })

  h('readCard', z.string(), async (id) => {
    const meta = ctx.index.get(id)
    if (!meta) throw new Error(`Card not found: ${id}`)
    return readCardAtPath(ctx.getConfig().rootPath, meta.path)
  })

  h('createCard', z.object({
    namespace: z.string(),
    question: z.string().min(1),
    body: z.string(),
    tags: z.array(z.string()).optional()
  }), async (input) => {
    const rootPath = ctx.getConfig().rootPath
    const full = await createCardOnDisk(rootPath, input)
    ctx.watcher.suppressNext(full.path, full.mtime, full.bodyHash)
    const { body: _b, ...meta } = full; void _b
    ctx.index.upsert(meta)
    return full
  })

  h('updateCard', z.object({
    id: z.string(),
    question: z.string().optional(),
    body: z.string().optional(),
    tags: z.array(z.string()).optional()
  }), async (input) => {
    const rootPath = ctx.getConfig().rootPath
    const meta = ctx.index.get(input.id)
    if (!meta) throw new Error(`Card not found: ${input.id}`)
    await updateCardOnDisk(meta.path, input)
    const full = await readCardAtPath(rootPath, meta.path)
    ctx.watcher.suppressNext(full.path, full.mtime, full.bodyHash)
    const { body: _b, ...nextMeta } = full; void _b
    ctx.index.upsert(nextMeta)
    return full
  })

  h('moveCard', z.object({ id: z.string(), namespace: z.string() }), async (input) => {
    const rootPath = ctx.getConfig().rootPath
    const meta = ctx.index.get(input.id)
    if (!meta) throw new Error(`Card not found: ${input.id}`)
    const newPath = await moveCardOnDisk(rootPath, meta.path, input.namespace)
    const full = await readCardAtPath(rootPath, newPath)
    ctx.watcher.suppressNext(full.path, full.mtime, full.bodyHash)
    const { body: _b, ...nextMeta } = full; void _b
    ctx.index.upsert(nextMeta)
    return full
  })

  h('deleteCard', z.string(), async (id) => {
    const meta = ctx.index.get(id)
    if (!meta) throw new Error(`Card not found: ${id}`)
    await deleteCardOnDisk(meta.path)
    await deleteState(ctx.getConfig().rootPath, id)
    ctx.index.removeById(id)
  })

  h('rateReview', z.object({ id: z.string(), rating: z.enum(RATINGS) }), async (input) => {
    const cfg = ctx.getConfig()
    const scheduler = createScheduler(cfg.fsrs)
    const current = await readState(cfg.rootPath, input.id)
    const next = rateCard(scheduler, current, input.rating)
    await writeState(cfg.rootPath, next)
    return next
  })

  h('openInExternalEditor', z.string(), async (id) => {
    const meta = ctx.index.get(id)
    if (!meta) throw new Error(`Card not found: ${id}`)
    await openInExternalEditor(meta.path, ctx.getConfig().externalEditor)
  })

  h('getConfig', VOID, async () => ctx.getConfig())
  h('updateConfig', z.record(z.any()), async (patch) => {
    const next = await patchConfig(configPath(), ctx.getConfig(), patch as Partial<Config>)
    ctx.setConfig(next)
    return next
  })

  h('searchCards', z.string(), async (q) => {
    const lc = q.toLowerCase()
    return ctx.index.all().filter(m => m.question.toLowerCase().includes(lc) || m.tags.some(t => t.toLowerCase().includes(lc)))
  })

  h('rescan', VOID, async () => {
    await ctx.index.buildFrom(ctx.getConfig().rootPath)
    ctx.win.webContents.send('index-rebuilt')
  })

  h('getDashboardData', z.array(z.enum(WIDGET_IDS)), async (widgets) => {
    return computeDashboard(ctx, widgets)
  })

  const onAdded = (id: string) => ctx.win.webContents.send('card-added', id)
  const onChanged = (id: string) => ctx.win.webContents.send('card-changed', id)
  const onRemoved = (id: string) => ctx.win.webContents.send('card-removed', id)
  ctx.watcher.on('card-added', onAdded)
  ctx.watcher.on('card-changed', onChanged)
  ctx.watcher.on('card-removed', onRemoved)

  // Orphan state cleanup on startup
  listStateIds(ctx.getConfig().rootPath).then(ids => {
    for (const id of ids) if (!ctx.index.get(id)) deleteState(ctx.getConfig().rootPath, id)
  })

  return () => {
    ctx.watcher.off('card-added', onAdded)
    ctx.watcher.off('card-changed', onChanged)
    ctx.watcher.off('card-removed', onRemoved)
    for (const ch of [
      'listNamespaces','listCards','getDueQueue','readCard','createCard','updateCard',
      'moveCard','deleteCard','rateReview','openInExternalEditor','getConfig','updateConfig',
      'searchCards','rescan','getDashboardData'
    ]) ipcMain.removeHandler(ch)
  }
}

async function computeDashboard(ctx: Ctx, widgets: WidgetId[]): Promise<DashboardData> {
  const cfg = ctx.getConfig()
  const rootPath = cfg.rootPath
  const all = ctx.index.all()
  const states = await Promise.all(all.map(async m => ({ meta: m, state: await readState(rootPath, m.id) })))
  const result: DashboardData = {}

  const dayKey = (d: Date) => d.toISOString().slice(0, 10)

  if (widgets.includes('due-forecast')) {
    const now = Date.now()
    const todayKey = dayKey(new Date())
    const next7: number[] = Array(7).fill(0)
    let today = 0
    for (const { state } of states) {
      const due = new Date(state.due).getTime()
      const diffDays = Math.floor((due - now) / 86_400_000)
      if (due <= now || dayKey(new Date(due)) === todayKey) today++
      else if (diffDays >= 0 && diffDays < 7) next7[diffDays]! += 1
    }
    result.dueForecast = { today, next7Days: next7 }
  }

  if (widgets.includes('namespace-ranking')) {
    const byNs = new Map<string, { total: number; reps: number; sumRetention: number; count: number }>()
    for (const { meta, state } of states) {
      const k = meta.namespace || '(root)'
      const r = retention(state)
      const cur = byNs.get(k) ?? { total: 0, reps: 0, sumRetention: 0, count: 0 }
      cur.total++; cur.reps += state.reps; cur.sumRetention += r; cur.count++
      byNs.set(k, cur)
    }
    result.namespaceRanking = Array.from(byNs.entries())
      .map(([namespace, v]) => ({ namespace, retention: v.count ? v.sumRetention / v.count : 0, count: v.total }))
      .sort((a, b) => a.retention - b.retention)
  }

  if (widgets.includes('leech-list')) {
    result.leechList = states
      .filter(s => s.state.lapses >= 1)
      .sort((a, b) => b.state.lapses - a.state.lapses)
      .slice(0, 10)
      .map(({ meta, state }) => ({ id: meta.id, question: meta.question, lapses: state.lapses, namespace: meta.namespace }))
  }

  if (widgets.includes('heatmap')) {
    result.heatmap = states.map(({ meta, state }) => ({
      id: meta.id, question: meta.question, retention: retention(state), namespace: meta.namespace
    }))
  }

  if (widgets.includes('activity-streak')) {
    const byDay = new Map<string, number>()
    for (const { state } of states) for (const h of state.history) {
      const k = h.ts.slice(0, 10)
      byDay.set(k, (byDay.get(k) ?? 0) + 1)
    }
    const days: Array<{ date: string; count: number }> = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      const k = dayKey(d)
      days.push({ date: k, count: byDay.get(k) ?? 0 })
    }
    let streak = 0
    for (let i = days.length - 1; i >= 0; i--) { if (days[i]!.count > 0) streak++; else break }
    const total = Array.from(byDay.values()).reduce((a, b) => a + b, 0)
    result.activityStreak = { days, currentStreak: streak, total }
  }

  if (widgets.includes('key-stats')) {
    const total = states.length
    const retentions = states.map(s => retention(s.state))
    const avg = retentions.length ? retentions.reduce((a, b) => a + b, 0) / retentions.length : 0
    const struggling = states.filter(s => s.state.lapses >= 3 || s.state.state === 'Relearning').length
    const mastered = states.filter(s => s.state.stability >= 30 && s.state.reps >= 4).length
    result.keyStats = { total, retention: avg, struggling, mastered }
  }

  return result
}

function retention(s: ReviewState): number {
  if (s.reps === 0) return 0
  const retries = s.history.filter(h => h.rating === 'Again').length
  return Math.max(0, Math.min(1, 1 - retries / Math.max(1, s.history.length)))
}
