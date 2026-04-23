import { create } from 'zustand'
import type { Config } from '../../shared/schema'
import type { NamespaceNode } from '../../shared/api'
import { unwrap } from '../lib/api'

type AppState = {
  config: Config | null
  namespaces: NamespaceNode | null
  selectedNamespaces: string[]
  theme: 'system' | 'light' | 'dark'
  init(): Promise<void>
  refreshNamespaces(): Promise<void>
  setSelectedNamespaces(ns: string[]): void
  setTheme(theme: 'system' | 'light' | 'dark'): Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  config: null,
  namespaces: null,
  selectedNamespaces: [],
  theme: 'system',
  async init() {
    const config = await unwrap(window.api.getConfig())
    const namespaces = await unwrap(window.api.listNamespaces())
    set({ config, namespaces, theme: config.theme })
    window.api.onCardAdded(() => get().refreshNamespaces())
    window.api.onCardRemoved(() => get().refreshNamespaces())
    window.api.onCardChanged(() => get().refreshNamespaces())
  },
  async refreshNamespaces() {
    const namespaces = await unwrap(window.api.listNamespaces())
    set({ namespaces })
  },
  setSelectedNamespaces(ns) { set({ selectedNamespaces: ns }) },
  async setTheme(theme) {
    const cfg = await unwrap(window.api.updateConfig({ theme }))
    set({ config: cfg, theme })
  }
}))
