import type { DashboardData } from '../../../shared/api'
export function KeyStatsWidget({ data }: { data: NonNullable<DashboardData['keyStats']> }) {
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Key stats</div>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-2xl font-semibold">{data.total}</div><div className="text-xs text-muted">Total</div></div>
        <div><div className="text-2xl font-semibold">{Math.round(data.retention * 100)}%</div><div className="text-xs text-muted">Retention</div></div>
        <div><div className="text-2xl font-semibold">{data.struggling}</div><div className="text-xs text-muted">Struggling</div></div>
        <div><div className="text-2xl font-semibold">{data.mastered}</div><div className="text-xs text-muted">Mastered</div></div>
      </div>
    </div>
  )
}
