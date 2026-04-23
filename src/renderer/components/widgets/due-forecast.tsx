import type { DashboardData } from '../../../shared/api'
export function DueForecastWidget({ data }: { data: NonNullable<DashboardData['dueForecast']> }) {
  const max = Math.max(1, data.today, ...data.next7Days)
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-2">Due today + 7-day forecast</div>
      <div className="text-3xl font-semibold mb-3">{data.today}<span className="text-xs text-muted ml-2">due today</span></div>
      <div className="flex items-end gap-1 h-20">
        {data.next7Days.map((c, i) => (
          <div key={i} className="flex-1 bg-accent/70 rounded-t" style={{ height: `${(c / max) * 100}%` }} title={`+${i}d: ${c}`} />
        ))}
      </div>
    </div>
  )
}
