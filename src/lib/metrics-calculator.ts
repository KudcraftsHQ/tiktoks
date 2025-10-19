import { TikTokPost } from '@/components/posts-table-columns'

/**
 * Aggregate metrics calculated from a set of posts
 */
export interface AggregateMetrics {
  totalPosts: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  avgViews: number
}

/**
 * Posting time analysis data for a specific hour
 */
export interface PostingTimeData {
  hour: number
  postCount: number
  totalViews: number
  avgViews: number
  totalLikes: number
  totalComments: number
  avgEngagementRate: number
}

/**
 * Best posting time information
 */
export interface BestTime {
  hour: number
  avgViews: number
  postCount: number
}

/**
 * Activity data point for heatmap
 */
export interface ActivityDataPoint {
  date: string
  count: number
}

/**
 * Calculate aggregate metrics from a set of posts
 *
 * Handles BigInt/string conversion for viewCount and aggregates all engagement metrics.
 * Returns 0 for avgViews if no posts provided.
 *
 * @param posts Array of TikTokPost objects
 * @returns Aggregate metrics object
 */
export function calculateAggregateMetrics(posts: TikTokPost[]): AggregateMetrics {
  if (posts.length === 0) {
    return {
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      avgViews: 0
    }
  }

  let totalViews = 0
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0

  posts.forEach(post => {
    // Handle BigInt or string conversion for viewCount
    const viewCount = typeof post.viewCount === 'bigint'
      ? Number(post.viewCount)
      : Number(post.viewCount || 0)

    totalViews += viewCount
    totalLikes += Number(post.likeCount || 0)
    totalComments += Number(post.commentCount || 0)
    totalShares += Number(post.shareCount || 0)
  })

  const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0

  return {
    totalPosts: posts.length,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    avgViews
  }
}

/**
 * Calculate time-based analysis grouped by hour of day
 *
 * Groups posts by the hour they were published (in the provided timezone),
 * calculates engagement metrics for each hour, and identifies top 3 posting times.
 *
 * @param posts Array of TikTokPost objects
 * @param timezone IANA timezone string (e.g., 'America/New_York')
 * @returns Object containing hourly data and best times
 */
export function calculateTimeAnalysis(
  posts: TikTokPost[],
  timezone: string
): { hourlyData: PostingTimeData[]; bestTimes: BestTime[] } {
  if (posts.length === 0) {
    return {
      hourlyData: [],
      bestTimes: []
    }
  }

  // Group posts by hour
  const hourlyMap = new Map<number, {
    posts: TikTokPost[]
    totalViews: number
    totalLikes: number
    totalComments: number
  }>()

  posts.forEach(post => {
    if (!post.publishedAt) return

    const date = new Date(post.publishedAt)

    // Get hour in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    })

    const hourString = formatter.format(date)
    const hour = parseInt(hourString, 10)

    if (!hourlyMap.has(hour)) {
      hourlyMap.set(hour, {
        posts: [],
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0
      })
    }

    const hourData = hourlyMap.get(hour)!
    hourData.posts.push(post)

    const viewCount = typeof post.viewCount === 'bigint'
      ? Number(post.viewCount)
      : Number(post.viewCount || 0)

    hourData.totalViews += viewCount
    hourData.totalLikes += Number(post.likeCount || 0)
    hourData.totalComments += Number(post.commentCount || 0)
  })

  // Convert to PostingTimeData array
  const hourlyData: PostingTimeData[] = []

  for (let hour = 0; hour < 24; hour++) {
    const hourData = hourlyMap.get(hour)

    if (hourData && hourData.posts.length > 0) {
      const avgViews = Math.round(hourData.totalViews / hourData.posts.length)
      const totalEngagement = hourData.totalLikes + hourData.totalComments
      const avgEngagementRate = hourData.totalViews > 0
        ? Math.round((totalEngagement / hourData.totalViews) * 100)
        : 0

      hourlyData.push({
        hour,
        postCount: hourData.posts.length,
        totalViews: hourData.totalViews,
        avgViews,
        totalLikes: hourData.totalLikes,
        totalComments: hourData.totalComments,
        avgEngagementRate
      })
    }
  }

  // Sort by hour ascending
  hourlyData.sort((a, b) => a.hour - b.hour)

  // Extract top 3 hours by avgViews
  const bestTimes = hourlyData
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 3)
    .map(data => ({
      hour: data.hour,
      avgViews: data.avgViews,
      postCount: data.postCount
    }))

  return { hourlyData, bestTimes }
}

/**
 * Calculate activity data grouped by date
 *
 * Groups posts by their published date (ISO format YYYY-MM-DD)
 * and returns count of posts per date for use in heatmap visualization.
 * Handles posts with missing publishedAt dates by skipping them.
 *
 * @param posts Array of TikTokPost objects
 * @returns Array of activity data points (date, count)
 */
export function calculateActivityData(posts: TikTokPost[]): ActivityDataPoint[] {
  const dateMap = new Map<string, number>()

  posts.forEach(post => {
    if (!post.publishedAt) return

    const date = new Date(post.publishedAt)
    const dateKey = date.toISOString().split('T')[0]

    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
  })

  // Convert to sorted array
  return Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get the earliest post date from a set of posts
 *
 * Finds and returns the ISO string of the earliest publishedAt date.
 * Returns null if no posts have a publishedAt date.
 *
 * @param posts Array of TikTokPost objects
 * @returns ISO date string or null if no valid dates found
 */
export function getFirstPostDate(posts: TikTokPost[]): string | null {
  if (posts.length === 0) return null

  let earliest: Date | null = null

  posts.forEach(post => {
    if (!post.publishedAt) return

    const date = new Date(post.publishedAt)
    if (!earliest || date < earliest) {
      earliest = date
    }
  })

  if (!earliest) return null

  return earliest.toISOString().split('T')[0]
}
