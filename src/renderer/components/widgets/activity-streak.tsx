import type { DashboardData } from '../../../shared/api'
export function ActivityStreakWidget({ data }: { data: NonNullable<DashboardData['activityStreak']> }) {
  const max = Math.max(1, ...data.days.map(d => d.count))
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Last 90 days</div>
      <div className="grid grid-flow-col grid-rows-7 gap-[2px] mb-3">
        {data.days.map(d => (
          <div key={d.date} title={`${d.date}: ${d.count}`}
               className="w-3 h-3 rounded-sm"
               style={{ background: d.count === 0 ? 'rgb(var(--border))' : `rgba(46,125,91,${0.25 + (d.count / max) * 0.75})` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span>🔥 {data.currentStreak}-day streak</span>
        <span className="text-muted">{data.total} reviews</span>
      </div>
    </div>
  )
}
