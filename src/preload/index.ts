import { contextBridge, ipcRenderer } from 'electron'
import type { Api, MenuVerb } from '../shared/api'
import { MENU_VERBS } from '../shared/api'

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
  deleteNamespace: (ns) => invoke('deleteNamespace', ns),
  rateReview: (input) => invoke('rateReview', input),
  openInExternalEditor: (id) => invoke('openInExternalEditor', id),
  saveAsset: (input) => invoke('saveAsset', input),
  getConfig: () => invoke('getConfig'),
  updateConfig: (patch) => invoke('updateConfig', patch),
  searchCards: (q) => invoke('searchCards', q),
  rescan: () => invoke('rescan'),
  exportCards: (input) => invoke('exportCards', input),
  pickImportFile: () => invoke('pickImportFile'),
  importArchive: (input) => invoke('importArchive', input),
  pickVaultFolder: () => invoke('pickVaultFolder'),
  completeOnboarding: (input) => invoke('completeOnboarding', input),
  getDefaultVaultPath: () => invoke('getDefaultVaultPath'),
  copyDiagnostics: () => invoke('copyDiagnostics'),
  onCardChanged: (cb) => on('card-changed', cb),
  onCardAdded: (cb) => on('card-added', cb),
  onCardRemoved: (cb) => on('card-removed', cb),
  onReviewRated: (cb) => on('review-rated', cb),
  onIndexRebuilt: (cb) => on('index-rebuilt', cb),
  onMenuCommand: (cb) => {
    const offs = MENU_VERBS.map(verb => on(`menu:${verb}`, () => cb(verb as MenuVerb)))
    return () => offs.forEach(off => off())
  }
}

contextBridge.exposeInMainWorld('api', api)
