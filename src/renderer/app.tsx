import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/sidebar'
import { useAppStore } from './stores/app-store'
import { ReviewRoute } from './routes/review'
import { BrowseRoute } from './routes/browse'
import { EditorRoute } from './routes/editor'
import { DashboardRoute } from './routes/dashboard'
import { SettingsRoute } from './routes/settings'

export function App() {
  const { config, init } = useAppStore()
  useEffect(() => { init() }, [init])
  if (!config) return <div className="p-6 text-muted">Loading…</div>
  return (
    <HashRouter>
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"           element={<Navigate to="/review" />} />
            <Route path="/review"     element={<ReviewRoute />} />
            <Route path="/browse"     element={<BrowseRoute />} />
            <Route path="/editor/new" element={<EditorRoute mode="new" />} />
            <Route path="/editor/:id" element={<EditorRoute mode="edit" />} />
            <Route path="/dashboard"  element={<DashboardRoute />} />
            <Route path="/settings"   element={<SettingsRoute />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
