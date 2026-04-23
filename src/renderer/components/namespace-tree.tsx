import type { NamespaceNode } from '../../shared/api'
import { useAppStore } from '../stores/app-store'

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
        <label className="flex items-center gap-2 px-2 py-0.5 text-sm hover:bg-border/40 rounded cursor-pointer" style={{ paddingLeft: 8 + depth * 12 }}>
          <input type="checkbox" checked={checked} onChange={toggle} className="accent-accent" />
          <span className="flex-1">{node.name}</span>
          {node.dueCount > 0 && <span className="text-xs text-muted">{node.dueCount}</span>}
        </label>
      )}
      {node.children.map(c => <NodeRow key={c.path} node={c} depth={depth + (node.path ? 1 : 0)} />)}
    </div>
  )
}

export function NamespaceTree() {
  const { namespaces } = useAppStore()
  if (!namespaces) return null
  if (namespaces.children.length === 0) {
    return <div className="text-xs text-muted px-2 py-4">No cards yet. Press ⌘N to create one.</div>
  }
  return <div><NodeRow node={namespaces} depth={0} /></div>
}
