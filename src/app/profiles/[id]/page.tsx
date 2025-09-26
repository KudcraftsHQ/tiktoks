'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PostsTable } from '@/components/PostsTable'
import { PostTypeFilter } from '@/components/PostTypeFilter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Users,
  Heart,
  Video,
  CheckCircle,
  User
} from 'lucide-react'
import { TikTokPost } from '@/components/posts-table-columns'
import { TikTokProfile } from '@/components/profiles-table-columns'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface ProfilePostsResult {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
  page: number
  limit: number
  error?: string
}

export default function ProfileDetailPage() {
  const params = useParams()
  const profileId = params.id as string

  const [profile, setProfile] = useState<TikTokProfile | null>(null)
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'video' | 'photo'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)


  const fetchProfile = useCallback(async () => {
    if (!profileId) return

    setProfileLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profileId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile')
      }

      setProfile(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile')
    } finally {
      setProfileLoading(false)
    }
  }, [profileId])

  const fetchProfilePosts = useCallback(async () => {
    if (!profileId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      })

      if (contentTypeFilter !== 'all') {
        params.append('contentType', contentTypeFilter)
      }

      const response = await fetch(`/api/tiktok/profiles/${profileId}/posts?${params.toString()}`)
      const result: ProfilePostsResult = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile posts')
      }

      setPosts(result.posts)
      setTotalPosts(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [profileId, currentPage, contentTypeFilter])

  const handleRefresh = useCallback(() => {
    fetchProfile()
    fetchProfilePosts()
  }, [fetchProfile, fetchProfilePosts])

  // Load profile and posts on mount and when filters change
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    fetchProfilePosts()
  }, [fetchProfilePosts])

  const formatNumber = (num?: number | null): string => {
    if (!num) return '0'
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    )
  }

  const filteredPosts = useMemo(() =>
    posts.filter(post => {
      if (contentTypeFilter === 'all') return true
      return post.contentType === contentTypeFilter
    }), [posts, contentTypeFilter]
  )

  if (profileLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading profile...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error || 'Profile not found'}</p>
            <Link href="/profiles">
              <Button className="mt-4" variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profiles
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
      <div className="container mx-auto py-8 space-y-8">
        {/* Header with back button */}
        <div className="flex items-center space-x-4">
          <Link href="/profiles">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold">@{profile.handle}</h1>
              {profile.verified && (
                <CheckCircle className="w-6 h-6 text-blue-500" />
              )}
            </div>
            <p className="text-muted-foreground">
              {profile.nickname} • Last updated {formatDate(profile.updatedAt)}
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Profile Info */}
        <div className="bg-background border rounded-lg p-6">
          <div className="flex items-start space-x-6">
          {/* Avatar */}
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={`${profile.handle} avatar`}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <User className="w-12 h-12 text-muted-foreground" />
            </div>
          )}

          {/* Profile details and metrics */}
          <div className="flex-1">
            {profile.bio && (
              <p className="text-muted-foreground mb-4">{profile.bio}</p>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-lg font-bold">
                  {formatNumber(profile.followerCount)}
                </div>
                <div className="text-xs text-muted-foreground">Followers</div>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Users className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-lg font-bold">
                  {formatNumber(profile.followingCount)}
                </div>
                <div className="text-xs text-muted-foreground">Following</div>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Video className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <div className="text-lg font-bold">
                  {formatNumber(profile.videoCount)}
                </div>
                <div className="text-xs text-muted-foreground">Videos</div>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <div className="text-lg font-bold">
                  {formatNumber(profile.likeCount)}
                </div>
                <div className="text-xs text-muted-foreground">Likes</div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on TikTok
            </Button>
          </div>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Posts section */}
        <div className="bg-background border rounded-lg">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Posts ({formatNumber(totalPosts)} total, {formatNumber(filteredPosts.length)} shown)
              </h2>
              <PostTypeFilter
                value={contentTypeFilter}
                onChange={setContentTypeFilter}
              />
            </div>
          </div>
          <div className="p-6">
            {posts.length > 0 ? (
              <PostsTable posts={filteredPosts} />
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Loading posts...</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Video className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No posts found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  No posts have been saved for this profile yet. Use the Profile Explorer to fetch and save posts from @{profile.handle}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}