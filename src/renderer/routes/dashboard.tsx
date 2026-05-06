import { useEffect, useMemo, useState } from 'react'
import type { DashboardData } from '../../shared/api'
import type { WidgetId } from '../../shared/constants'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'
import { DueForecastWidget } from '../components/widgets/due-forecast'
import { NamespaceRankingWidget } from '../components/widgets/namespace-ranking'
import { LeechListWidget } from '../components/widgets/leech-list'
import { HeatmapWidget } from '../components/widgets/heatmap'
import { ActivityStreakWidget } from '../components/widgets/activity-streak'
import { KeyStatsWidget } from '../components/widgets/key-stats'

export function DashboardRoute() {
  const { config } = useAppStore()
  const [data, setData] = useState<DashboardData | null>(null)

  const enabled: WidgetId[] = useMemo(() => {
    if (!config) return []
    return config.dashboard.widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order).map(w => w.id)
  }, [config])

  useEffect(() => {
    if (!enabled.length) { setData({}); return }
    unwrap(window.api.getDashboardData(enabled)).then(setData)
  }, [enabled])

  if (!data) return <div className="p-10 text-muted italic font-editorial animate-pulse-soft">Loading dashboard…</div>

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="font-editorial text-[28px] font-semibold leading-none mb-8 animate-fade-in-up">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {enabled.map((id, i) => {
          let node: React.ReactNode = null
          switch (id) {
            case 'due-forecast':      node = data.dueForecast      && <DueForecastWidget      data={data.dueForecast} />; break
            case 'namespace-ranking': node = data.namespaceRanking && <NamespaceRankingWidget data={data.namespaceRanking} />; break
            case 'leech-list':        node = data.leechList        && <LeechListWidget        data={data.leechList} />; break
            case 'heatmap':           node = data.heatmap          && <HeatmapWidget          data={data.heatmap} />; break
            case 'activity-streak':   node = data.activityStreak   && <ActivityStreakWidget   data={data.activityStreak} />; break
            case 'key-stats':         node = data.keyStats         && <KeyStatsWidget         data={data.keyStats} />; break
            default: return null
          }
          if (!node) return null
          return (
            <div
              key={id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${80 + i * 60}ms` }}
            >
              {node}
            </div>
          )
        })}
      </div>
    </div>
  )
}
