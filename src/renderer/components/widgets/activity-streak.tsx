import type { DashboardData } from '../../../shared/api'
export function ActivityStreakWidget({ data }: { data: NonNullable<DashboardData['activityStreak']> }) {
  const max = Math.max(1, ...data.days.map(d => d.count))
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="eyebrow">Last 90 days</div>
        <div className="flex items-center gap-2 text-[11px] text-muted" aria-label="Legend: light for fewer reviews, dark for more">
          <span>less</span>
          <span className="flex gap-0.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'rgb(var(--border) / 0.7)' }} />
            <span className="w-3 h-3 rounded-sm" style={{ background: 'rgb(var(--accent) / 0.35)' }} />
            <span className="w-3 h-3 rounded-sm" style={{ background: 'rgb(var(--accent) / 0.65)' }} />
            <span className="w-3 h-3 rounded-sm" style={{ background: 'rgb(var(--accent) / 1)' }} />
          </span>
          <span>more</span>
        </div>
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] mb-4">
        {data.days.map((d, i) => (
          <div key={d.date} title={`${d.date}: ${d.count}`}
               className="w-3 h-3 rounded-[2px] animate-pop-soft"
               style={{
                 background: d.count === 0 ? 'rgb(var(--border) / 0.7)' : `rgb(var(--accent) / ${0.2 + (d.count / max) * 0.8})`,
                 animationDelay: `${Math.min(i * 4, 360)}ms`
               }} />
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
