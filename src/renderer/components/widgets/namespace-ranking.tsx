import type { DashboardData } from '../../../shared/api'
export function NamespaceRankingWidget({ data }: { data: NonNullable<DashboardData['namespaceRanking']> }) {
  return (
    <div className="card-surface p-5">
      <div className="eyebrow mb-4">Weakest namespaces</div>
      {data.length === 0 ? (
        <div className="text-[13px] text-muted italic font-editorial py-2">Not enough data yet.</div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {data.slice(0, 6).map(row => {
            const pct = Math.round(row.retention * 100)
            return (
              <div key={row.namespace}>
                <div className="flex justify-between items-baseline text-[12.5px] mb-1">
                  <span className="font-mono text-fg truncate pr-2">{row.namespace}</span>
                  <span className="shrink-0 text-muted tabular-nums text-[11px]">
                    <span className="font-semibold text-fg">{pct}%</span>
                    <span className="mx-1">·</span>
                    <span>{row.count}</span>
                  </span>
                </div>
                <div className="h-1 bg-border/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: pct < 60 ? 'rgb(var(--danger))' : pct < 80 ? 'rgb(var(--accent))' : 'rgb(16 185 129)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
