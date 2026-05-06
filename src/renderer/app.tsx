import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Sidebar } from './components/sidebar'
import { KeymapModal } from './components/keymap-modal'
import { useAppStore } from './stores/app-store'
import { ReviewRoute } from './routes/review'
import { BrowseRoute } from './routes/browse'
import { EditorRoute } from './routes/editor'
import { CardViewRoute } from './routes/card-view'
import { DashboardRoute } from './routes/dashboard'
import { SettingsRoute } from './routes/settings'

export function App() {
  const { config, init } = useAppStore()
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => { init() }, [init])
  if (!config) return <div className="h-full flex items-center justify-center text-muted italic font-editorial">Loading…</div>
  return (
    <HashRouter>
      <GlobalShortcuts onOpenHelp={() => setHelpOpen(true)} />
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"           element={<Navigate to="/review" />} />
            <Route path="/review"     element={<ReviewRoute />} />
            <Route path="/browse"     element={<BrowseRoute />} />
            <Route path="/editor/new" element={<EditorRoute mode="new" />} />
            <Route path="/editor/:id" element={<EditorRoute mode="edit" />} />
            <Route path="/card/:id"   element={<CardViewRoute />} />
            <Route path="/dashboard"  element={<DashboardRoute />} />
            <Route path="/settings"   element={<SettingsRoute />} />
          </Routes>
        </main>
      </div>
      {helpOpen && <KeymapModal onClose={() => setHelpOpen(false)} />}
    </HashRouter>
  )
}

function GlobalShortcuts({ onOpenHelp }: { onOpenHelp: () => void }) {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null
        const tag = t?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return
        e.preventDefault()
        onOpenHelp()
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'n') { e.preventDefault(); navigate('/editor/new') }
      else if (k === ',') { e.preventDefault(); navigate('/settings') }
      else if (k === '1') { e.preventDefault(); navigate('/review') }
      else if (k === '2') { e.preventDefault(); navigate('/browse') }
      else if (k === '3') { e.preventDefault(); navigate('/dashboard') }
      else if (k === '4') { e.preventDefault(); navigate('/settings') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, onOpenHelp])
  return null
}
