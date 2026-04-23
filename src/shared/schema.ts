import { z } from 'zod'
import { RATINGS, FSRS_STATES, WIDGET_IDS } from './constants'

export const PromptFrontmatterSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1)
})
export type PromptFrontmatter = z.infer<typeof PromptFrontmatterSchema>

export const CardFrontmatterSchema = z.object({
  id: z.string().min(1),
  prompts: z.array(PromptFrontmatterSchema).min(1),
  tags: z.array(z.string()).default([]),
  created: z.string().datetime()
})
export type CardFrontmatter = z.infer<typeof CardFrontmatterSchema>

export const CardMetaSchema = CardFrontmatterSchema.extend({
  namespace: z.string(),
  path: z.string(),
  mtime: z.number(),
  bodyHash: z.string()
})
export type CardMeta = z.infer<typeof CardMetaSchema>

export const CardFullSchema = CardMetaSchema.extend({
  body: z.string()
})
export type CardFull = z.infer<typeof CardFullSchema>

export const ReviewHistoryEntrySchema = z.object({
  ts: z.string().datetime(),
  rating: z.enum(RATINGS),
  elapsed_days: z.number()
})

export const ReviewStateSchema = z.object({
  id: z.string(),
  due: z.string().datetime(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.enum(FSRS_STATES),
  last_review: z.string().datetime().nullable(),
  history: z.array(ReviewHistoryEntrySchema).default([])
})
export type ReviewState = z.infer<typeof ReviewStateSchema>

export const DashboardWidgetConfigSchema = z.object({
  id: z.enum(WIDGET_IDS),
  enabled: z.boolean(),
  order: z.number().int().min(0)
})

export const ConfigSchema = z.object({
  rootPath: z.string(),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  dashboard: z.object({
    widgets: z.array(DashboardWidgetConfigSchema)
  }),
  fsrs: z.object({
    desiredRetention: z.number().min(0.5).max(0.99).default(0.9),
    maximumInterval: z.number().int().positive().default(365)
  }),
  externalEditor: z.string().nullable().default(null)
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Omit<Config, 'rootPath'> = {
  theme: 'system',
  dashboard: {
    widgets: [
      { id: 'due-forecast', enabled: true, order: 0 },
      { id: 'namespace-ranking', enabled: true, order: 1 },
      { id: 'leech-list', enabled: true, order: 2 },
      { id: 'heatmap', enabled: false, order: 3 },
      { id: 'activity-streak', enabled: false, order: 4 },
      { id: 'key-stats', enabled: false, order: 5 }
    ]
  },
  fsrs: { desiredRetention: 0.9, maximumInterval: 365 },
  externalEditor: null
}
