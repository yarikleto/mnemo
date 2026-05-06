import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from './components/sidebar'
import { KeymapModal } from './components/keymap-modal'
import { UpdateBanner } from './components/update-banner'
import { useAppStore } from './stores/app-store'
import { unwrap } from './lib/api'
import { ReviewRoute } from './routes/review'
import { BrowseRoute } from './routes/browse'
import { EditorRoute } from './routes/editor'
import { CardViewRoute } from './routes/card-view'
import { DashboardRoute } from './routes/dashboard'
import { SettingsRoute } from './routes/settings'
import { OnboardingRoute } from './routes/onboarding'

export function App() {
  const { config, init } = useAppStore()
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => { init() }, [init])
  if (!config) {
    return (
      <div className="h-full flex items-center justify-center text-muted italic font-editorial animate-fade-in">
        <span className="animate-pulse-soft">Loading…</span>
      </div>
    )
  }
  const onboarded = Boolean(config.onboardedAt && config.rootPath)
  return (
    <HashRouter>
      <OnboardingGate onboarded={onboarded} />
      <LastRouteReplay onboarded={onboarded} />
      <LastRouteRecorder />
      <GlobalShortcuts onOpenHelp={() => setHelpOpen(true)} />
      <MenuRouter />
      <Shell onboarded={onboarded} helpOpen={helpOpen} onCloseHelp={() => setHelpOpen(false)} />
    </HashRouter>
  )
}

function Shell({ onboarded, helpOpen, onCloseHelp }: { onboarded: boolean; helpOpen: boolean; onCloseHelp: () => void }) {
  const location = useLocation()
  const showSidebar = onboarded && location.pathname !== '/onboarding'
  return (
    <>
      <div className="flex flex-col h-full">
        <UpdateBanner />
        <div className="flex flex-1 min-h-0">
          {showSidebar && <Sidebar />}
          <main className="flex-1 overflow-auto">
            <RoutedView />
          </main>
        </div>
      </div>
      {helpOpen && <KeymapModal onClose={onCloseHelp} />}
    </>
  )
}

function OnboardingGate({ onboarded }: { onboarded: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!onboarded && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
  }, [onboarded, location.pathname, navigate])
  return null
}

// Persists the last visited route so the next launch lands the user back where
// they were. Skips /onboarding so a quit-on-onboarding doesn't pin them there
// next launch (the OnboardingGate handles that path independently).
function LastRouteRecorder() {
  const location = useLocation()
  const config = useAppStore(s => s.config)
  useEffect(() => {
    if (!config?.onboardedAt || !config.rootPath) return
    const p = location.pathname
    if (!p || p === '/onboarding') return
    if (p === config.lastRoute) return
    const handle = window.setTimeout(() => {
      window.api.updateConfig({ lastRoute: p }).then(r => {
        if (r.ok) useAppStore.setState({ config: r.data })
      })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [location.pathname, config?.onboardedAt, config?.rootPath, config?.lastRoute])
  return null
}

// Replays the persisted lastRoute on first render after onboarding is done,
// once per session. Skips when the user already navigated somewhere explicitly.
function LastRouteReplay({ onboarded }: { onboarded: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const config = useAppStore(s => s.config)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done) return
    if (!onboarded || !config?.lastRoute) { setDone(true); return }
    if (location.pathname !== '/' && location.pathname !== '/review') { setDone(true); return }
    if (config.lastRoute === '/onboarding') { setDone(true); return }
    navigate(config.lastRoute, { replace: true })
    setDone(true)
  }, [onboarded, config?.lastRoute, location.pathname, navigate, done])
  return null
}

function RoutedView() {
  const location = useLocation()
  // Group editor variants under one key so navigating new → /editor/:id (after first save)
  // doesn't re-mount the editor mid-typing. Card-view → editor still re-fades.
  const animKey = location.pathname.startsWith('/editor/') ? '/editor' : location.pathname
  return (
    <div key={animKey} className="h-full animate-fade-in-up">
      <Routes location={location}>
        <Route path="/"           element={<Navigate to="/review" />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/review"     element={<ReviewRoute />} />
        <Route path="/browse"     element={<BrowseRoute />} />
        <Route path="/editor/new" element={<EditorRoute mode="new" />} />
        <Route path="/editor/:id" element={<EditorRoute mode="edit" />} />
        <Route path="/card/:id"   element={<CardViewRoute />} />
        <Route path="/dashboard"  element={<DashboardRoute />} />
        <Route path="/settings"   element={<SettingsRoute />} />
      </Routes>
    </div>
  )
}

function MenuRouter() {
  const navigate = useNavigate()
  const { setTheme, theme } = useAppStore()
  useEffect(() => {
    const off = window.api.onMenuCommand(async verb => {
      switch (verb) {
        case 'open-settings':  navigate('/settings'); return
        case 'new-card':       navigate('/editor/new'); return
        case 'nav-review':     navigate('/review'); return
        case 'nav-browse':     navigate('/browse'); return
        case 'nav-dashboard':  navigate('/dashboard'); return
        case 'toggle-theme': {
          const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
          setTheme(next)
          return
        }
        case 'find':
          window.dispatchEvent(new CustomEvent('mnemo:focus-search'))
          return
        case 'import':
          window.dispatchEvent(new CustomEvent('mnemo:open-import'))
          return
        case 'export':
          window.dispatchEvent(new CustomEvent('mnemo:open-export'))
          return
        case 'open-vault-folder': {
          const r = await unwrap(window.api.pickVaultFolder())
          if (!r) return
          const cfg = await unwrap(window.api.completeOnboarding({ rootPath: r.path }))
          useAppStore.setState({ config: cfg })
          await useAppStore.getState().refreshNamespaces()
          navigate('/review', { replace: true })
          return
        }
        case 'copy-diagnostics': {
          const r = await unwrap(window.api.copyDiagnostics())
          try { await navigator.clipboard.writeText(r.text) } catch {}
          return
        }
      }
    })
    return () => off()
  }, [navigate, setTheme, theme])
  return null
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
