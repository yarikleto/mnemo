import type { DashboardData } from '../../../shared/api'
export function KeyStatsWidget({ data }: { data: NonNullable<DashboardData['keyStats']> }) {
  const stat = (value: string | number, label: string, idx: number, accent = false) => (
    <div className="animate-fade-in-up" style={{ animationDelay: `${120 + idx * 70}ms` }}>
      <div className={`font-editorial text-[28px] font-semibold leading-none tabular-nums ${accent ? 'text-accent' : 'text-fg'}`}>{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  )
  return (
    <div className="card-surface p-5">
      <div className="eyebrow mb-4">Library</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {stat(data.total, 'Total', 0)}
        {stat(data.retention === null ? '—' : `${Math.round(data.retention * 100)}%`, 'Retention', 1, true)}
        {stat(data.struggling, 'Struggling', 2)}
        {stat(data.mastered, 'Mastered', 3)}
      </div>
    </div>
  )
}
