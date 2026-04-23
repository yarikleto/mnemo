import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
export function HeatmapWidget({ data }: { data: NonNullable<DashboardData['heatmap']> }) {
  const navigate = useNavigate()
  const color = (r: number) => {
    if (r > 0.85) return 'bg-emerald-600'
    if (r > 0.65) return 'bg-emerald-400'
    if (r > 0.45) return 'bg-amber-400'
    return 'bg-rose-500'
  }
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Topic heatmap</div>
      <div className="flex flex-wrap gap-1">
        {data.map(c => (
          <div key={c.id} onClick={() => navigate(`/editor/${c.id}`)}
               title={`${c.question} · ${Math.round(c.retention * 100)}%`}
               className={`w-4 h-4 rounded cursor-pointer ${color(c.retention)}`} />
        ))}
      </div>
    </div>
  )
}
