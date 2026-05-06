import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
import { promptPreview } from '../../../shared/prompt'

export function HeatmapWidget({ data }: { data: NonNullable<DashboardData['heatmap']> }) {
  const navigate = useNavigate()
  const color = (r: number) => {
    if (r > 0.85) return 'bg-emerald-600/90'
    if (r > 0.65) return 'bg-emerald-400/90'
    if (r > 0.45) return 'bg-amber-400/90'
    return 'bg-rose-500/90'
  }
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="eyebrow">Retention heatmap</div>
        <div className="flex items-center gap-2 text-[11px] text-muted" aria-label="Legend: red for weak retention, green for strong">
          <span>weak</span>
          <span className="flex gap-0.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500/90" />
            <span className="w-3 h-3 rounded-sm bg-amber-400/90" />
            <span className="w-3 h-3 rounded-sm bg-emerald-400/90" />
            <span className="w-3 h-3 rounded-sm bg-emerald-600/90" />
          </span>
          <span>strong</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.map(c => (
          <div key={c.cardId} onClick={() => navigate(`/card/${c.cardId}`)}
               title={`${promptPreview(c.promptText, 80)} · ${Math.round(c.retention * 100)}%`}
               className={`w-3.5 h-3.5 rounded-[2px] cursor-pointer transition hover:scale-125 hover:shadow-sm ${color(c.retention)}`} />
        ))}
      </div>
    </div>
  )
}
