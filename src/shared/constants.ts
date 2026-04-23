export const RATINGS = ['Again', 'Hard', 'Good', 'Easy'] as const
export type Rating = typeof RATINGS[number]

export const FSRS_STATES = ['New', 'Learning', 'Review', 'Relearning'] as const
export type FsrsState = typeof FSRS_STATES[number]

export const WIDGET_IDS = [
  'due-forecast',
  'namespace-ranking',
  'leech-list',
  'heatmap',
  'activity-streak',
  'key-stats'
] as const
export type WidgetId = typeof WIDGET_IDS[number]
