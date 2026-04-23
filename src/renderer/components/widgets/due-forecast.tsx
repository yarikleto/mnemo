import type { DashboardData } from '../../../shared/api'
export function DueForecastWidget({ data }: { data: NonNullable<DashboardData['dueForecast']> }) {
  const max = Math.max(1, data.today, ...data.next7Days)
  return (
    <div className="card-surface p-5">
      <div className="eyebrow mb-4">Due forecast</div>
      <div className="flex items-baseline gap-2 mb-5">
        <span className="font-editorial text-[44px] font-semibold leading-none text-accent tabular-nums">{data.today}</span>
        <span className="text-[12px] text-muted">due today</span>
      </div>
      <div className="flex items-end gap-1.5 h-20 mb-1.5">
        {data.next7Days.map((c, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end" title={`+${i + 1}d: ${c}`}>
            <div
              className="bg-accent/80 rounded-t-[2px] transition-all min-h-[2px]"
              style={{ height: `${(c / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {data.next7Days.map((_, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-mono text-muted tabular-nums">+{i + 1}</div>
        ))}
      </div>
    </div>
  )
}
