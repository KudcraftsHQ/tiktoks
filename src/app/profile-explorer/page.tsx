'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileInput } from '@/components/ProfileInput'
import { PostsTable } from '@/components/PostsTable'
import { PostTypeFilter } from '@/components/PostTypeFilter'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { SidebarLayout } from '@/components/SidebarLayout'
import { Button } from '@/components/ui/button'
import { RefreshCw, Database } from 'lucide-react'

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
  const [isAddingCarousel, setIsAddingCarousel] = useState(false)
  const [upsertStats, setUpsertStats] = useState<{
    postsCreated: number
    postsUpdated: number
    totalPosts: number
  } | null>(null)

  // Dummy handler for sidebar carousel functionality
  const handleAddCarousel = async (url: string) => {
    setIsAddingCarousel(true)
    try {
      const response = await fetch('/api/carousels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.message || 'Failed to add carousel')
      } else {
        alert('Carousel added successfully!')
      }
    } catch (error) {
      console.error('Failed to add carousel:', error)
      alert('Failed to add carousel')
    } finally {
      setIsAddingCarousel(false)
    }
  }

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
    <SidebarLayout
      onAddCarousel={handleAddCarousel}
      isAddingCarousel={isAddingCarousel}
    >
      <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">TikTok Profile Explorer</h1>
          <p className="text-muted-foreground">
            Explore and analyze TikTok profiles, posts, and metrics
          </p>
        </div>
        {currentHandle && (
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Input</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileInput
            onSubmit={fetchProfileVideos}
            loading={loading}
            placeholder="Enter TikTok handle (e.g., @username) or profile URL"
          />
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {posts.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                Posts from @{currentHandle} ({filteredPosts.length} of {posts.length})
              </h2>
              <PostTypeFilter
                value={contentTypeFilter}
                onChange={setContentTypeFilter}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="w-4 h-4" />
              {upsertStats && (
                <span className="text-green-600">
                  Synced: {upsertStats.postsCreated} new, {upsertStats.postsUpdated} updated
                </span>
              )}
            </div>
          </div>

          <PostsTable
            posts={filteredPosts}
          />

          {hasMore && (
            <div className="flex justify-center">
              <LoadMoreButton
                onClick={handleLoadMore}
                loading={loading}
                disabled={contentTypeFilter !== 'all'}
                tooltip={
                  contentTypeFilter !== 'all'
                    ? 'Load more is only available when showing all posts'
                    : undefined
                }
              />
            </div>
          )}
        </>
      )}

      {loading && posts.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading profile videos...</span>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </SidebarLayout>
  )
}