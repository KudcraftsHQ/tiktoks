/**
 * Stats Calculator Utility
 * Calculates performance metrics and comparisons for TikTok posts
 */

export interface PostMetrics {
  viewCount: number
  likeCount: number
  shareCount: number
  commentCount: number
  saveCount: number
}

export interface MetricsComparison {
  viewsChange: number
  viewsChangePercent: number
  likesChange: number
  likesChangePercent: number
  sharesChange: number
  sharesChangePercent: number
  commentsChange: number
  commentsChangePercent: number
  savesChange: number
  savesChangePercent: number
  engagementRate: number
  engagementRateChange: number
}

/**
 * Calculates the percentage change between two values
 * @param newValue - The new/current value
 * @param oldValue - The old/baseline value
 * @returns Percentage change (positive for increase, negative for decrease)
 */
export function calculatePercentChange(newValue: number, oldValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0
  }
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * Calculates engagement rate for a post
 * @param metrics - Post metrics
 * @returns Engagement rate as a percentage
 */
export function calculateEngagementRate(metrics: PostMetrics): number {
  if (metrics.viewCount === 0) return 0

  const totalEngagements =
    metrics.likeCount +
    metrics.shareCount +
    metrics.commentCount +
    metrics.saveCount

  return (totalEngagements / metrics.viewCount) * 100
}

/**
 * Compares two sets of post metrics
 * @param current - Current/posted metrics
 * @param baseline - Baseline/original metrics
 * @returns Comparison object with changes and percentages
 */
export function compareMetrics(
  current: PostMetrics,
  baseline: PostMetrics
): MetricsComparison {
  const viewsChange = current.viewCount - baseline.viewCount
  const likesChange = current.likeCount - baseline.likeCount
  const sharesChange = current.shareCount - baseline.shareCount
  const commentsChange = current.commentCount - baseline.commentCount
  const savesChange = current.saveCount - baseline.saveCount

  const currentEngagementRate = calculateEngagementRate(current)
  const baselineEngagementRate = calculateEngagementRate(baseline)
  const engagementRateChange = currentEngagementRate - baselineEngagementRate

  return {
    viewsChange,
    viewsChangePercent: calculatePercentChange(current.viewCount, baseline.viewCount),
    likesChange,
    likesChangePercent: calculatePercentChange(current.likeCount, baseline.likeCount),
    sharesChange,
    sharesChangePercent: calculatePercentChange(current.shareCount, baseline.shareCount),
    commentsChange,
    commentsChangePercent: calculatePercentChange(current.commentCount, baseline.commentCount),
    savesChange,
    savesChangePercent: calculatePercentChange(current.saveCount, baseline.saveCount),
    engagementRate: currentEngagementRate,
    engagementRateChange
  }
}

/**
 * Formats a number to a compact string (e.g., 1.2K, 3.4M)
 * @param num - The number to format
 * @returns Formatted string
 */
export function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toString()
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`
  return `${(num / 1000000000).toFixed(1)}B`
}

/**
 * Formats a percentage change with sign and color indication
 * @param percent - The percentage value
 * @returns Object with formatted text and color class
 */
export function formatPercentChange(percent: number): {
  text: string
  colorClass: string
  isPositive: boolean
} {
  const isPositive = percent >= 0
  const sign = isPositive ? '+' : ''
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600'

  return {
    text: `${sign}${percent.toFixed(1)}%`,
    colorClass,
    isPositive
  }
}

/**
 * Calculates growth trend from historical metrics
 * @param history - Array of historical metrics ordered by date
 * @returns Trend direction: 'up', 'down', or 'stable'
 */
export function calculateTrend(history: Array<{ viewCount: number }>): 'up' | 'down' | 'stable' {
  if (history.length < 2) return 'stable'

  const recent = history.slice(-5) // Last 5 data points
  if (recent.length < 2) return 'stable'

  let increases = 0
  let decreases = 0

  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].viewCount - recent[i - 1].viewCount
    if (change > 0) increases++
    else if (change < 0) decreases++
  }

  if (increases > decreases) return 'up'
  if (decreases > increases) return 'down'
  return 'stable'
}

/**
 * Normalizes BigInt values to numbers for JSON serialization
 * @param value - BigInt, number, or string value
 * @returns Number value
 */
export function normalizeBigInt(value: bigint | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'string') return parseInt(value, 10) || 0
  return typeof value === 'bigint' ? Number(value) : value
}
