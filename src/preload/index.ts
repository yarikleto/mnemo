import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

const invoke = <T>(ch: string, args?: unknown): Promise<T> => ipcRenderer.invoke(ch, args ?? null) as Promise<T>
const on = (ch: string, cb: (...a: any[]) => void) => {
  const handler = (_e: unknown, ...args: any[]) => cb(...args)
  ipcRenderer.on(ch, handler)
  return () => ipcRenderer.off(ch, handler)
}

const api: Api = {
  listNamespaces: () => invoke('listNamespaces'),
  listCards: (namespace) => invoke('listCards', namespace),
  getDueQueue: (filter) => invoke('getDueQueue', filter),
  readCard: (id) => invoke('readCard', id),
  getDashboardData: (widgets) => invoke('getDashboardData', widgets),
  createCard: (input) => invoke('createCard', input),
  updateCard: (input) => invoke('updateCard', input),
  moveCard: (input) => invoke('moveCard', input),
  deleteCard: (id) => invoke('deleteCard', id),
  rateReview: (input) => invoke('rateReview', input),
  openInExternalEditor: (id) => invoke('openInExternalEditor', id),
  saveAsset: (input) => invoke('saveAsset', input),
  getConfig: () => invoke('getConfig'),
  updateConfig: (patch) => invoke('updateConfig', patch),
  searchCards: (q) => invoke('searchCards', q),
  rescan: () => invoke('rescan'),
  onCardChanged: (cb) => on('card-changed', cb),
  onCardAdded: (cb) => on('card-added', cb),
  onCardRemoved: (cb) => on('card-removed', cb),
  onReviewRated: (cb) => on('review-rated', cb),
  onIndexRebuilt: (cb) => on('index-rebuilt', cb)
}

contextBridge.exposeInMainWorld('api', api)
