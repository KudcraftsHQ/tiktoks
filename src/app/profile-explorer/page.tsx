'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ProfileInput } from '@/components/ProfileInput'
import { PostsTable } from '@/components/PostsTable'
import { PostTypeFilter } from '@/components/PostTypeFilter'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { Button } from '@/components/ui/button'
import { RefreshCw, Database } from 'lucide-react'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'

interface TikTokPost {
  id: string
  tiktokId: string
  tiktokUrl: string
  contentType: 'video' | 'photo'
  title?: string
  description?: string
  authorNickname?: string
  authorHandle?: string
  authorAvatar?: string
  hashtags: Array<{ text: string; url: string }>
  mentions: string[]
  viewCount: number
  likeCount: number
  shareCount: number
  commentCount: number
  saveCount: number
  duration?: number
  videoUrl?: string
  coverUrl?: string
  musicUrl?: string
  images: Array<{
    url: string
    width: number
    height: number
  }>
  publishedAt: string
}

interface ProfileVideosResult {
  posts: TikTokPost[]
  hasMore: boolean
  maxCursor?: string
  minCursor?: string
}

export default function ProfileExplorerPage() {
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentHandle, setCurrentHandle] = useState<string>('')
  const [maxCursor, setMaxCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'video' | 'photo'>('all')
  const [upsertStats, setUpsertStats] = useState<{
    postsCreated: number
    postsUpdated: number
    totalPosts: number
  } | null>(null)


  const fetchProfileVideos = useCallback(async (
    handle: string,
    cursor?: string,
    isLoadMore = false
  ) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        handle: handle.startsWith('@') ? handle.slice(1) : handle,
        trim: 'true'
      })

      if (cursor) {
        params.append('max_cursor', cursor)
      }

      const response = await fetch(`/api/tiktok/profile/videos?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile videos')
      }

      const data: ProfileVideosResult = result.data

      if (isLoadMore) {
        setPosts(prevPosts => [...prevPosts, ...data.posts])
      } else {
        setPosts(data.posts)
        setCurrentHandle(handle)
      }

      setMaxCursor(data.maxCursor)
      setHasMore(data.hasMore)

      // Update upsert stats if available
      if (result.upsertResult?.stats) {
        setUpsertStats(result.upsertResult.stats)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      if (!isLoadMore) {
        setPosts([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoadMore = useCallback(() => {
    if (currentHandle && maxCursor && hasMore && !loading) {
      fetchProfileVideos(currentHandle, maxCursor, true)
    }
  }, [currentHandle, maxCursor, hasMore, loading, fetchProfileVideos])

  const handleRefresh = useCallback(() => {
    if (currentHandle) {
      fetchProfileVideos(currentHandle)
    }
  }, [currentHandle, fetchProfileVideos])


  const filteredPosts = posts.filter(post => {
    if (contentTypeFilter === 'all') return true
    return post.contentType === contentTypeFilter
  })

  return (
    <PageLayout
      title="TikTok Profile Explorer"
      description="Explore and analyze TikTok profiles, posts, and metrics"
      headerActions={
        currentHandle ? (
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        ) : undefined
      }
    >
      {/* Unified Header Section */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="py-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <ProfileInput
                onSubmit={fetchProfileVideos}
                loading={loading}
                placeholder="Enter TikTok handle (e.g., @username) or profile URL"
              />
            </div>
            <div className="flex items-start">
              <PostTypeFilter
                value={contentTypeFilter}
                onChange={setContentTypeFilter}
              />
            </div>
          </div>

          {posts.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t">
              <h2 className={`${designTokens.typography.sectionTitle.responsive} font-semibold`}>
                Posts from @{currentHandle} ({filteredPosts.length} of {posts.length})
              </h2>
              <LoadMoreButton
                onClick={handleLoadMore}
                loading={loading}
                disabled={!hasMore || contentTypeFilter !== 'all'}
                tooltip={
                  !hasMore
                    ? 'No more posts to load'
                    : contentTypeFilter !== 'all'
                    ? 'Load more is only available when showing all posts'
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 mt-6">
          <CardContent className={`${designTokens.spacing.cardContent.responsive} py-6`}>
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {posts.length > 0 && (
        <PostsTable
          posts={filteredPosts}
          isLoading={loading}
        />
      )}

      {loading && posts.length === 0 && (
        <Card className="mt-6">
          <CardContent className={`${designTokens.spacing.cardContent.responsive} flex items-center justify-center py-12`}>
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading profile videos...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  )
}