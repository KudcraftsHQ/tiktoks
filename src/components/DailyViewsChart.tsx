'use client'

import { useMemo } from 'react'
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface DailyViewsDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  views: number
  isEstimated: boolean // True if this is backfilled/estimated data
}

interface DailyViewsChartProps {
  data: DailyViewsDataPoint[]
  loading?: boolean
}

export function DailyViewsChart({ data, loading = false }: DailyViewsChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map(point => ({
      date: new Date(point.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      views: point.views,
      isEstimated: point.isEstimated
    }))
  }, [data])

  const maxViews = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.max(...chartData.map(d => d.views))
  }, [chartData])

  if (loading) {
    return (
      <div className="h-full rounded-lg border border-border bg-card">
        <div className="p-4">
          <h3 className="text-base font-semibold mb-4">Daily Views</h3>
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-sm text-muted-foreground">Loading chart data...</div>
          </div>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full rounded-lg border border-border bg-card">
        <div className="p-4">
          <h3 className="text-base font-semibold mb-4">Daily Views</h3>
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-sm text-muted-foreground">No data available</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full rounded-lg border border-border bg-card">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Daily Views</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-purple-500" />
              <span className="text-muted-foreground">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-purple-300 opacity-50" />
              <span className="text-muted-foreground">Estimated</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                return value.toString()
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value: any, name: string, props: any) => {
                const views = Number(value)
                const formattedViews = views >= 1000000
                  ? `${(views / 1000000).toFixed(2)}M`
                  : views >= 1000
                  ? `${(views / 1000).toFixed(2)}K`
                  : views.toString()

                return [
                  `${formattedViews} views${props.payload.isEstimated ? ' (estimated)' : ''}`,
                  ''
                ]
              }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Line
              type="monotone"
              dataKey="views"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
