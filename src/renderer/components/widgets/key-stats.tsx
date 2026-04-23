import type { DashboardData } from '../../../shared/api'
export function KeyStatsWidget({ data }: { data: NonNullable<DashboardData['keyStats']> }) {
  const stat = (value: string | number, label: string, accent = false) => (
    <div>
      <div className={`font-editorial text-[28px] font-semibold leading-none tabular-nums ${accent ? 'text-accent' : 'text-fg'}`}>{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  )
  return (
    <div className="card-surface p-5">
      <div className="eyebrow mb-4">Library</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {stat(data.total, 'Total')}
        {stat(`${Math.round(data.retention * 100)}%`, 'Retention', true)}
        {stat(data.struggling, 'Struggling')}
        {stat(data.mastered, 'Mastered')}
      </div>
    </div>
  )
}
