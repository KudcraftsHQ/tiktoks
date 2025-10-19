'use client'

import React from 'react'
import { Eye, Heart, Share2, MessageCircle, Bookmark, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCompactNumber, formatPercentChange, compareMetrics, normalizeBigInt } from '@/lib/stats-calculator'

interface PostMetrics {
  viewCount: string | number
  likeCount: number
  shareCount: number
  commentCount: number
  saveCount: number
}

interface RemixStatsCardProps {
  originalPostStats: PostMetrics
  postedStats?: PostMetrics | null
  showComparison?: boolean
}

export function RemixStatsCard({
  originalPostStats,
  postedStats,
  showComparison = true
}: RemixStatsCardProps) {
  const originalMetrics = {
    viewCount: normalizeBigInt(originalPostStats.viewCount),
    likeCount: originalPostStats.likeCount || 0,
    shareCount: originalPostStats.shareCount || 0,
    commentCount: originalPostStats.commentCount || 0,
    saveCount: originalPostStats.saveCount || 0
  }

  const postedMetrics = postedStats ? {
    viewCount: normalizeBigInt(postedStats.viewCount),
    likeCount: postedStats.likeCount || 0,
    shareCount: postedStats.shareCount || 0,
    commentCount: postedStats.commentCount || 0,
    saveCount: postedStats.saveCount || 0
  } : null

  const comparison = postedMetrics && showComparison
    ? compareMetrics(postedMetrics, originalMetrics)
    : null

  const StatRow = ({
    icon: Icon,
    label,
    originalValue,
    postedValue,
    change
  }: {
    icon: React.ElementType
    label: string
    originalValue: number
    postedValue?: number
    change?: number
  }) => (
    <div className="flex items-center justify-between text-xs py-1">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-gray-500" />
        <span className="text-gray-600">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-900 font-medium">
          {formatCompactNumber(originalValue)}
        </span>
        {postedValue !== undefined && (
          <>
            <span className="text-gray-400">→</span>
            <span className="text-gray-900 font-medium">
              {formatCompactNumber(postedValue)}
            </span>
            {change !== undefined && (
              <span className={formatPercentChange(change).colorClass}>
                {formatPercentChange(change).text}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )

  const PerformanceIndicator = () => {
    if (!comparison) return null

    const overallChange = comparison.viewsChangePercent
    const icon = overallChange > 5 ? TrendingUp : overallChange < -5 ? TrendingDown : Minus

    return (
      <div className={`
        flex items-center gap-2 px-2 py-1 rounded text-xs font-medium
        ${overallChange > 5 ? 'bg-green-50 text-green-700' :
          overallChange < -5 ? 'bg-red-50 text-red-700' :
          'bg-gray-50 text-gray-700'}
      `}>
        {React.createElement(icon, { className: 'h-3 w-3' })}
        <span>
          {overallChange > 5 ? 'Outperforming' :
           overallChange < -5 ? 'Underperforming' :
           'Similar Performance'}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2">
        <h4 className="text-sm font-semibold">
          {postedMetrics ? 'Performance Comparison' : 'Original Post Stats'}
        </h4>
        <PerformanceIndicator />
      </div>

      {/* Stats Rows */}
      <div className="space-y-1">
        <StatRow
          icon={Eye}
          label="Views"
          originalValue={originalMetrics.viewCount}
          postedValue={postedMetrics?.viewCount}
          change={comparison?.viewsChangePercent}
        />
        <StatRow
          icon={Heart}
          label="Likes"
          originalValue={originalMetrics.likeCount}
          postedValue={postedMetrics?.likeCount}
          change={comparison?.likesChangePercent}
        />
        <StatRow
          icon={Share2}
          label="Shares"
          originalValue={originalMetrics.shareCount}
          postedValue={postedMetrics?.shareCount}
          change={comparison?.sharesChangePercent}
        />
        <StatRow
          icon={MessageCircle}
          label="Comments"
          originalValue={originalMetrics.commentCount}
          postedValue={postedMetrics?.commentCount}
          change={comparison?.commentsChangePercent}
        />
        <StatRow
          icon={Bookmark}
          label="Saves"
          originalValue={originalMetrics.saveCount}
          postedValue={postedMetrics?.saveCount}
          change={comparison?.savesChangePercent}
        />
      </div>

      {/* Engagement Rate */}
      {comparison && (
        <div className="border-t pt-2 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">Engagement Rate</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-900 font-semibold">
                {comparison.engagementRate.toFixed(2)}%
              </span>
              {comparison.engagementRateChange !== 0 && (
                <span className={
                  comparison.engagementRateChange > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }>
                  ({comparison.engagementRateChange > 0 ? '+' : ''}
                  {comparison.engagementRateChange.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
