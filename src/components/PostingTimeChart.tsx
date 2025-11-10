'use client'

import React, { useMemo } from 'react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { Bar, CartesianGrid, Line, ComposedChart, XAxis, YAxis, Area } from 'recharts'

export interface PostingTimeChartData {
  hour: number
  postCount: number
  avgViews: number
  totalViews: number
  totalLikes: number
  totalComments: number
  avgEngagementRate: number
}

export interface PostingTimeChartBestTime {
  hour: number
  avgViews: number
  postCount: number
}

interface PostingTimeChartProps {
  data: PostingTimeChartData[]
  bestTimes?: PostingTimeChartBestTime[]
  loading?: boolean
  topPosts?: Array<{
    hour: number
    posts: Array<{
      id: string
      coverUrl?: string
      viewCount: number
      likeCount: number
    }>
  }>
}

/**
 * Beautiful combo chart showing posting time analysis with bars and line
 */
export function PostingTimeChart({ data, bestTimes = [], loading = false }: PostingTimeChartProps) {
  // Format hour to 12-hour format with AM/PM
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  // Prepare chart data - fill in all 24 hours
  const chartData = useMemo(() => {
    const dataMap = new Map(data.map(d => [d.hour, d]))

    return Array.from({ length: 24 }, (_, hour) => {
      const item = dataMap.get(hour)
      return {
        hour: formatHour(hour),
        hourNumber: hour,
        posts: item?.postCount || 0,
        avgViews: item ? Math.round(item.avgViews) : 0,
      }
    })
  }, [data])

  // Chart configuration
  const chartConfig = {
    posts: {
      label: 'Posts',
      color: 'hsl(var(--chart-1))',
    },
    avgViews: {
      label: 'Avg Views',
      color: 'hsl(var(--chart-2))',
    },
  }

  if (loading) {
    return (
      <div className="h-full rounded-lg border border-border bg-card flex flex-col">
        <div className="p-4 pb-3 flex-shrink-0">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex-1 px-4 pb-4 min-h-0">
          <div className="h-[200px] w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-full rounded-lg border border-border bg-card">
        <div className="p-4 pb-3">
          <h3 className="text-base font-semibold">Best posting times</h3>
        </div>
        <div className="p-4 pt-0">
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-sm">No data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full rounded-lg border border-border bg-card flex flex-col">
      <div className="p-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Best posting times</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#C27AFF]" />
              <span className="text-muted-foreground">{chartConfig.posts.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-600" />
              <span className="text-muted-foreground">{chartConfig.avgViews.label}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 min-h-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart data={chartData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C27AFF" stopOpacity={1} />
                <stop offset="100%" stopColor="#C27AFF" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={1}
              angle={-45}
              textAnchor="end"
              height={50}
              className="text-[10px]"
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}`}
              className="text-[10px]"
              width={30}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              className="text-[10px]"
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="min-w-[200px] p-3"
                  labelClassName="mb-2 font-semibold"
                />
              }
            />
            <Bar
              yAxisId="left"
              dataKey="posts"
              fill="url(#barGradient)"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="avgViews"
              stroke="rgb(168, 85, 247)"
              fill="rgb(192, 132, 252)"
              fillOpacity={0.08}
              strokeWidth={1.5}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgViews"
              stroke="rgb(147, 51, 234)"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: 'rgb(147, 51, 234)', strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 4.5, fill: 'rgb(147, 51, 234)', strokeWidth: 2.5, stroke: 'white' }}
              legendType="none"
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  )
}
