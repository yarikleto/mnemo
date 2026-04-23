import type { CardFull, CardMeta, ReviewState, Config } from './schema'
import type { Rating, WidgetId } from './constants'

export type NamespaceNode = {
  name: string
  path: string
  dueCount: number
  totalCount: number
  children: NamespaceNode[]
}

export type DashboardData = Partial<{
  dueForecast: { today: number; next7Days: number[] }
  namespaceRanking: Array<{ namespace: string; retention: number; count: number }>
  leechList: Array<{ id: string; question: string; lapses: number; namespace: string }>
  heatmap: Array<{ id: string; question: string; retention: number; namespace: string }>
  activityStreak: { days: Array<{ date: string; count: number }>; currentStreak: number; total: number }
  keyStats: { total: number; retention: number; struggling: number; mastered: number }
}>

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type ArchivePreview = {
  version: number
  exportedAt: string
  cardCount: number
}

export type ImportSummary = {
  imported: number
  skipped: number
  overwritten: number
  warnings: string[]
}

export interface Api {
  listNamespaces(): Promise<ApiResult<NamespaceNode>>
  listCards(namespace?: string): Promise<ApiResult<CardMeta[]>>
  getDueQueue(filter: { namespaces?: string[] }): Promise<ApiResult<CardMeta[]>>
  readCard(id: string): Promise<ApiResult<CardFull>>
  getDashboardData(widgets: WidgetId[]): Promise<ApiResult<DashboardData>>

  createCard(input: { namespace: string; question: string; body: string; tags?: string[] }): Promise<ApiResult<CardFull>>
  updateCard(input: { id: string; question?: string; body?: string; tags?: string[] }): Promise<ApiResult<CardFull>>
  moveCard(input: { id: string; namespace: string }): Promise<ApiResult<CardFull>>
  deleteCard(id: string): Promise<ApiResult<void>>
  deleteNamespace(namespace: string): Promise<ApiResult<{ deleted: number }>>
  rateReview(input: { id: string; rating: Rating }): Promise<ApiResult<ReviewState>>
  openInExternalEditor(id: string): Promise<ApiResult<void>>
  saveAsset(input: { cardId: string; bytes: Uint8Array; ext: string }): Promise<ApiResult<{ relativePath: string }>>

  getConfig(): Promise<ApiResult<Config>>
  updateConfig(patch: Partial<Config>): Promise<ApiResult<Config>>

  searchCards(query: string): Promise<ApiResult<CardMeta[]>>
  rescan(): Promise<ApiResult<void>>

  exportCards(input: { ids: string[] }): Promise<ApiResult<{ path: string } | null>>
  pickImportFile(): Promise<ApiResult<{ path: string; preview: ArchivePreview } | null>>
  importArchive(input: {
    path: string
    targetNamespace: string
    overwrite: boolean
  }): Promise<ApiResult<ImportSummary>>

  onCardChanged(cb: (id: string) => void): () => void
  onCardAdded(cb: (id: string) => void): () => void
  onCardRemoved(cb: (id: string) => void): () => void
  onReviewRated(cb: (id: string) => void): () => void
  onIndexRebuilt(cb: () => void): () => void
}

declare global {
  interface Window {
    api: Api
  }
}
