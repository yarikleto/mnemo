import type { DashboardData } from '../../../shared/api'
export function NamespaceRankingWidget({ data }: { data: NonNullable<DashboardData['namespaceRanking']> }) {
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Weakest namespaces</div>
      <div className="flex flex-col gap-2">
        {data.slice(0, 6).map(row => (
          <div key={row.namespace}>
            <div className="flex justify-between text-xs"><span>{row.namespace}</span><span className="text-muted">{Math.round(row.retention * 100)}% · {row.count}</span></div>
            <div className="h-1.5 bg-border/60 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-accent" style={{ width: `${Math.round(row.retention * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
