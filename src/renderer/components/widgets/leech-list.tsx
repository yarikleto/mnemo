import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
export function LeechListWidget({ data }: { data: NonNullable<DashboardData['leechList']> }) {
  const navigate = useNavigate()
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Leech list</div>
      <div className="flex flex-col gap-1">
        {data.map(c => (
          <div key={c.id} onClick={() => navigate(`/editor/${c.id}`)} className="flex justify-between text-xs py-1 px-2 hover:bg-border/40 rounded cursor-pointer">
            <span className="truncate">{c.question}</span>
            <span className="text-muted ml-2">{c.lapses} fails</span>
          </div>
        ))}
        {data.length === 0 && <div className="text-xs text-muted">No leeches yet.</div>}
      </div>
    </div>
  )
}
