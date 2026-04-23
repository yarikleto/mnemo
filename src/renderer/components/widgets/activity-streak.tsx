import type { DashboardData } from '../../../shared/api'
export function ActivityStreakWidget({ data }: { data: NonNullable<DashboardData['activityStreak']> }) {
  const max = Math.max(1, ...data.days.map(d => d.count))
  return (
    <div className="card-surface p-5">
      <div className="eyebrow mb-4">Last 90 days</div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] mb-4">
        {data.days.map(d => (
          <div key={d.date} title={`${d.date}: ${d.count}`}
               className="w-3 h-3 rounded-[2px]"
               style={{ background: d.count === 0 ? 'rgb(var(--border) / 0.7)' : `rgb(var(--accent) / ${0.2 + (d.count / max) * 0.8})` }} />
        ))}
      </div>
      <div className="flex justify-between items-baseline">
        <div>
          <div className="font-editorial text-[22px] font-semibold leading-none text-accent">{data.currentStreak}</div>
          <div className="text-[11px] text-muted mt-1">day streak</div>
        </div>
        <div className="text-right">
          <div className="font-mono tabular-nums text-[15px] font-semibold">{data.total}</div>
          <div className="text-[11px] text-muted mt-0.5">total reviews</div>
        </div>
      </div>
    </div>
  )
}
