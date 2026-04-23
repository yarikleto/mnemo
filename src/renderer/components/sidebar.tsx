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
    <aside className="w-60 shrink-0 bg-sidebar border-r border-border flex flex-col h-full">
      <div className="px-5 pt-5 pb-6">
        <div className="font-editorial text-[17px] font-semibold text-fg leading-none">Interview Prep</div>
        <div className="eyebrow mt-1.5">Spaced repetition</div>
      </div>

      <nav className="px-2 flex flex-col gap-0.5">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `relative block pl-5 pr-3 py-1.5 text-[13px] rounded-r-md transition-colors ${
                isActive
                  ? 'text-fg font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-accent before:rounded-r'
                  : 'text-muted font-medium hover:text-fg'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 pt-7 pb-2">
        <div className="eyebrow">Namespaces</div>
      </div>
      <div className="flex-1 overflow-auto px-1.5"><NamespaceTree /></div>

      <div className="p-3 border-t border-border flex gap-2 items-center">
        <NavLink to="/editor/new" className="btn-primary flex-1">
          <span className="text-base leading-none">+</span> New card
        </NavLink>
        <ThemeToggle />
      </div>
    </aside>
  )
}
