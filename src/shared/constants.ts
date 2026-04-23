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

export const WIDGET_INFO: Record<WidgetId, { title: string; description: string }> = {
  'due-forecast':      { title: 'Due forecast',        description: 'How many cards are due today and over the next 7 days — plan your session load.' },
  'namespace-ranking': { title: 'Weakest decks',       description: 'Decks ranked by retention, showing where your recall is slipping.' },
  'leech-list':        { title: 'Leech list',          description: 'Cards you keep failing — candidates to rewrite, split, or delete.' },
  'heatmap':           { title: 'Retention heatmap',   description: 'Every card as a colored tile (red = weak, green = strong). Click a tile to edit.' },
  'activity-streak':   { title: 'Activity streak',     description: '90-day review calendar, current consecutive-day streak, and lifetime review count.' },
  'key-stats':         { title: 'Library stats',       description: 'Totals at a glance — card count, overall retention, struggling, and mastered.' }
}
