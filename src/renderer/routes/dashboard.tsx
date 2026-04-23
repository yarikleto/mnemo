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

  if (!data) return <div className="p-6 text-muted">Loading dashboard…</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {enabled.map(id => {
          switch (id) {
            case 'due-forecast':      return data.dueForecast      && <DueForecastWidget      key={id} data={data.dueForecast} />
            case 'namespace-ranking': return data.namespaceRanking && <NamespaceRankingWidget key={id} data={data.namespaceRanking} />
            case 'leech-list':        return data.leechList        && <LeechListWidget        key={id} data={data.leechList} />
            case 'heatmap':           return data.heatmap          && <HeatmapWidget          key={id} data={data.heatmap} />
            case 'activity-streak':   return data.activityStreak   && <ActivityStreakWidget   key={id} data={data.activityStreak} />
            case 'key-stats':         return data.keyStats         && <KeyStatsWidget         key={id} data={data.keyStats} />
            default: return null
          }
        })}
      </div>
    </div>
  )
}
