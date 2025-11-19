'use client'

import { useMemo } from 'react'

interface HeatmapData {
  date: string // ISO date string (YYYY-MM-DD)
  count: number
}

interface PostingActivityHeatmapProps {
  data: HeatmapData[]
  showStreak?: boolean
  firstPostDate?: string | null // ISO date string of the first post
  dateRange?: { from?: Date; to?: Date } // Optional date range to limit display
}

export function PostingActivityHeatmap({ data, showStreak = false, firstPostDate, dateRange }: PostingActivityHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Convert data to internal format
    const processedData: { date: Date; count: number; month: string; dayOfWeek: number }[] = []

    // Create a map for quick lookup
    const dataMap = new Map<string, number>()
    data.forEach(item => {
      dataMap.set(item.date, item.count)
    })

    // Determine date range to display
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let startDate: Date
    let endDate: Date

    if (dateRange?.from && dateRange?.to) {
      // Use provided date range
      startDate = new Date(dateRange.from)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(dateRange.to)
      endDate.setHours(0, 0, 0, 0)
    } else {
      // Default to last 6 months
      endDate = today
      startDate = new Date(today)
      startDate.setMonth(startDate.getMonth() - 6)
      startDate.setHours(0, 0, 0, 0)
    }

    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Initialize all days in the range
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      date.setHours(0, 0, 0, 0)

      const dateKey = date.toISOString().split('T')[0]
      const count = dataMap.get(dateKey) || 0

      processedData.push({
        date,
        count,
        month: date.toLocaleString('en', { month: 'short' }),
        dayOfWeek: date.getDay() // 0 = Sunday, 1 = Monday, etc.
      })
    }

    return processedData
  }, [data, dateRange])

  // Calculate max count for color intensity
  const maxCount = Math.max(...heatmapData.map(d => d.count), 1)

  // Get color intensity based on count
  const getColorIntensity = (count: number): string => {
    if (count === 0) return 'bg-muted'
    const intensity = Math.ceil((count / maxCount) * 4)
    switch (intensity) {
      case 1: return 'bg-purple-200'
      case 2: return 'bg-purple-400'
      case 3: return 'bg-purple-600'
      case 4: return 'bg-purple-700'
      default: return 'bg-muted'
    }
  }

  // Calculate streak
  const streak = useMemo(() => {
    let currentStreak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].count > 0) {
        currentStreak++
      } else {
        // Only break if we've started counting (allow for today being empty)
        if (currentStreak > 0 || heatmapData[i].date.getTime() < today.getTime()) {
          break
        }
      }
    }

    return currentStreak
  }, [heatmapData])

  // Group by weeks starting from the first day in the range
  const { weeks, monthLabels } = useMemo(() => {
    if (heatmapData.length === 0) {
      return { weeks: [], monthLabels: [] }
    }

    // Adjust for the first day in range's position in the week
    const firstDayInRange = heatmapData[0]
    const firstDayOfWeek = firstDayInRange.dayOfWeek // 0 = Sunday, 1 = Monday, etc.

    // Convert to Monday-based (0 = Monday, 6 = Sunday)
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    // Create weeks array with proper structure
    const weeksData: (typeof heatmapData[0] | null)[][] = []
    let currentWeek: (typeof heatmapData[0] | null)[] = new Array(7).fill(null)

    // Fill in the offset for the first week
    for (let i = 0; i < offset; i++) {
      currentWeek[i] = null
    }

    // Fill in the data
    heatmapData.forEach((day) => {
      const dayIndex = day.dayOfWeek === 0 ? 6 : day.dayOfWeek - 1 // Convert to Monday-based
      currentWeek[dayIndex] = day

      // If we've filled Sunday (index 6), start a new week
      if (dayIndex === 6) {
        weeksData.push(currentWeek)
        currentWeek = new Array(7).fill(null)
      }
    })

    // Add the last week if it has any data
    if (currentWeek.some(d => d !== null)) {
      weeksData.push(currentWeek)
    }

    // Generate month labels
    const labels: { month: string; startWeek: number }[] = []
    let lastMonth = ''

    weeksData.forEach((week, weekIndex) => {
      const firstDayInWeek = week.find(d => d !== null)
      if (firstDayInWeek && firstDayInWeek.month !== lastMonth) {
        labels.push({ month: firstDayInWeek.month, startWeek: weekIndex })
        lastMonth = firstDayInWeek.month
      }
    })

    return { weeks: weeksData, monthLabels: labels }
  }, [heatmapData])

  const formattedFirstPostDate = useMemo(() => {
    if (!firstPostDate) return null
    const date = new Date(firstPostDate)
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [firstPostDate])

  return (
    <div className="h-full rounded-lg border border-border bg-card">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Posting activity</h3>
              {formattedFirstPostDate && (
                <span className="text-xs text-muted-foreground">
                  Since {formattedFirstPostDate}
                </span>
              )}
            </div>
            {showStreak && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-orange-500">🔥</span>
                <span className="font-medium">You are on a {streak} day streak</span>
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <span className="text-[10px] text-muted-foreground">Less</span>
            <div className="flex gap-1">
              <div className="h-[14px] w-[14px] rounded-[2px] bg-muted" />
              <div className="h-[14px] w-[14px] rounded-[2px] bg-purple-200" />
              <div className="h-[14px] w-[14px] rounded-[2px] bg-purple-400" />
              <div className="h-[14px] w-[14px] rounded-[2px] bg-purple-600" />
              <div className="h-[14px] w-[14px] rounded-[2px] bg-purple-700" />
            </div>
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>
      </div>
      <div className="p-4 pt-0">
        <div className="space-y-1">
          {/* Month labels */}
          <div className="pl-10">
            <div className="relative h-4">
              {monthLabels.map((label, i) => (
                <div
                  key={i}
                  className="absolute text-[10px] text-muted-foreground whitespace-nowrap"
                  style={{ left: `${label.startWeek * 17}px` }}
                >
                  {label.month}
                </div>
              ))}
            </div>
          </div>

          {/* Grid container */}
          <div className="flex gap-2">
            {/* Day labels - aligned with grid rows */}
            <div className="flex flex-col gap-1 w-8 pr-1">
              <div className="flex items-center h-[14px]">
                <span className="text-[10px] text-muted-foreground leading-none">Mon</span>
              </div>
              <div className="h-[14px]" />
              <div className="flex items-center h-[14px]">
                <span className="text-[10px] text-muted-foreground leading-none">Wed</span>
              </div>
              <div className="h-[14px]" />
              <div className="flex items-center h-[14px]">
                <span className="text-[10px] text-muted-foreground leading-none">Fri</span>
              </div>
              <div className="h-[14px]" />
              <div className="h-[14px]" />
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`h-[14px] w-[14px] rounded-[2px] ${day ? getColorIntensity(day.count) : 'bg-transparent'} transition-all ${day ? 'hover:ring-2 hover:ring-purple-400 cursor-pointer' : ''}`}
                      title={day ? `${day.date.toLocaleDateString()}: ${day.count} post${day.count !== 1 ? 's' : ''}` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
