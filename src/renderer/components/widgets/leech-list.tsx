import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
export function LeechListWidget({ data }: { data: NonNullable<DashboardData['leechList']> }) {
  const navigate = useNavigate()
  return (
    <div className="card-surface p-5">
      <div className="eyebrow mb-4">Leech list</div>
      {data.length === 0 ? (
        <div className="text-[13px] text-muted italic font-editorial py-2">No leeches — nice.</div>
      ) : (
        <div className="flex flex-col">
          {data.map((c, i) => (
            <div
              key={c.id}
              onClick={() => navigate(`/editor/${c.id}`)}
              className={`flex justify-between items-center py-2 px-1 text-[13px] cursor-pointer transition-colors hover:text-accent ${i === data.length - 1 ? '' : 'border-b border-border/50'}`}
            >
              <span className="font-editorial truncate pr-3">{c.question}</span>
              <span className="shrink-0 text-[11px] font-mono tabular-nums text-danger/80">{c.lapses}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
