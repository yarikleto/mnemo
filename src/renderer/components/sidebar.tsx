import { NavLink } from 'react-router-dom'
import { NamespaceTree } from './namespace-tree'
import { ThemeToggle } from './theme-toggle'

export function Sidebar() {
  const links = [
    { to: '/review',    label: 'Review' },
    { to: '/browse',    label: 'Browse' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/settings',  label: 'Settings' }
  ]
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-bg flex flex-col h-full">
      <div className="px-4 py-3 font-semibold">Interview Prep</div>
      <nav className="px-2">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `block px-2 py-1.5 text-sm rounded ${isActive ? 'bg-border/60 text-fg' : 'text-muted hover:text-fg hover:bg-border/30'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted mt-4">Namespaces</div>
      <div className="flex-1 overflow-auto px-1"><NamespaceTree /></div>
      <div className="p-3 border-t border-border flex justify-between items-center">
        <NavLink to="/editor/new" className="text-sm text-accent hover:underline">+ New card</NavLink>
        <ThemeToggle />
      </div>
    </aside>
  )
}
