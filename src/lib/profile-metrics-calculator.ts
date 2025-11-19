import { TikTokProfile } from '@/components/profiles-table-columns'

/**
 * Aggregate metrics calculated from a set of profiles
 */
export interface ProfileAggregateMetrics {
  totalProfiles: number
  totalPosts: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalSaves: number
  avgViews: number
}

/**
 * Metrics comparison between two periods
 */
export interface MetricsComparison {
  current: ProfileAggregateMetrics
  previous: ProfileAggregateMetrics
  comparison: {
    totalPosts: number
    totalViews: number
    avgViews: number
    totalLikes: number
    totalComments: number
    totalSaves: number
  }
}

/**
 * Calculate aggregate metrics from a set of profiles
 */
export function calculateProfileAggregateMetrics(profiles: TikTokProfile[]): ProfileAggregateMetrics {
  if (profiles.length === 0) {
    return {
      totalProfiles: 0,
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalSaves: 0,
      avgViews: 0
    }
  }

  let totalPosts = 0
  let totalViews = 0
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0
  let totalSaves = 0

  profiles.forEach(profile => {
    totalPosts += Number(profile.totalPosts || 0)
    totalViews += Number(profile.totalViews || 0)
    totalLikes += Number(profile.totalLikes || 0)
    totalComments += Number(profile.totalComments || 0)
    totalShares += Number(profile.totalShares || 0)
    totalSaves += Number(profile.totalSaves || 0)
  })

  const avgViews = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0

  return {
    totalProfiles: profiles.length,
    totalPosts,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    avgViews
  }
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Compare metrics between two periods
 */
export function compareMetrics(
  currentMetrics: ProfileAggregateMetrics,
  previousMetrics: ProfileAggregateMetrics
): MetricsComparison['comparison'] {
  return {
    totalPosts: calculatePercentageChange(currentMetrics.totalPosts, previousMetrics.totalPosts),
    totalViews: calculatePercentageChange(currentMetrics.totalViews, previousMetrics.totalViews),
    avgViews: calculatePercentageChange(currentMetrics.avgViews, previousMetrics.avgViews),
    totalLikes: calculatePercentageChange(currentMetrics.totalLikes, previousMetrics.totalLikes),
    totalComments: calculatePercentageChange(currentMetrics.totalComments, previousMetrics.totalComments),
    totalSaves: calculatePercentageChange(currentMetrics.totalSaves, previousMetrics.totalSaves)
  }
}
