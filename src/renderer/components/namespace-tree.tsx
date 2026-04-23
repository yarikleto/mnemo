import type { NamespaceNode } from '../../shared/api'
import { useAppStore } from '../stores/app-store'

function Counts({ due, total }: { due: number; total: number }) {
  if (total === 0) return null
  return (
    <span className="text-[10px] font-mono font-medium tabular-nums shrink-0">
      <span className={due > 0 ? 'text-accent' : 'text-muted/70'}>{due}</span>
      <span className="text-muted/50"> / </span>
      <span className="text-muted/80">{total}</span>
    </span>
  )
}

function NodeRow({ node, depth }: { node: NamespaceNode; depth: number }) {
  const { selectedNamespaces, setSelectedNamespaces } = useAppStore()
  const checked = selectedNamespaces.includes(node.path)
  const toggle = () => {
    if (!node.path) return
    setSelectedNamespaces(
      checked ? selectedNamespaces.filter(n => n !== node.path) : [...selectedNamespaces, node.path]
    )
  }
  return (
    <div>
      {node.path !== '' && (
        <label
          className={`flex items-center gap-2 py-1 pr-2 text-[12.5px] rounded cursor-pointer transition-colors ${
            checked ? 'text-fg' : 'text-muted hover:text-fg'
          }`}
          style={{ paddingLeft: 12 + depth * 14 }}
        >
          <input type="checkbox" checked={checked} onChange={toggle} className="w-3 h-3" />
          <span className="flex-1 truncate">{node.name}</span>
          <Counts due={node.dueCount} total={node.totalCount} />
        </label>
      )}
      {node.children.map(c => <NodeRow key={c.path} node={c} depth={depth + (node.path ? 1 : 0)} />)}
    </div>
  )
}

export function NamespaceTree() {
  const { namespaces, selectedNamespaces, setSelectedNamespaces } = useAppStore()
  if (!namespaces) return null
  if (namespaces.children.length === 0) {
    return (
      <div className="px-4 py-3 text-[12px] text-muted leading-relaxed">
        No cards yet.<br />
        Press <span className="kbd">⌘N</span> to create one.
      </div>
    )
  }
  const allChecked = selectedNamespaces.length === 0
  return (
    <div>
      <label
        className={`flex items-center gap-2 py-1 pr-2 text-[12.5px] rounded cursor-pointer transition-colors pl-3 ${
          allChecked ? 'text-fg font-medium' : 'text-muted hover:text-fg'
        }`}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => { if (!allChecked) setSelectedNamespaces([]) }}
          className="w-3 h-3"
        />
        <span className="flex-1 truncate">All decks</span>
        <Counts due={namespaces.dueCount} total={namespaces.totalCount} />
      </label>
      <NodeRow node={namespaces} depth={0} />
    </div>
  )
}
