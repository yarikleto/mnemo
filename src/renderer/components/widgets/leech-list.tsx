import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
import { promptPreview } from '../../../shared/prompt'

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
            <button
              key={c.cardId}
              type="button"
              onClick={() => navigate(`/card/${c.cardId}`)}
              aria-label={`Open card: ${promptPreview(c.promptText, 120)}`}
              className={`w-full text-left flex justify-between items-center py-2 px-1 text-[13px] cursor-pointer transition-colors hover:text-accent hover:translate-x-0.5 focus:outline-none focus-visible:text-accent focus-visible:ring-1 focus-visible:ring-accent/40 rounded animate-fade-in-up ${i === data.length - 1 ? '' : 'border-b border-border/50'}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="font-editorial truncate pr-3">{promptPreview(c.promptText, 120)}</span>
              <span className="shrink-0 text-[11px] font-mono tabular-nums text-danger/80">{c.lapses}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
