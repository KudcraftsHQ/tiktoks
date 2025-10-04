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
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { TikTokPost } from '@/components/posts-table-columns'
import { TikTokProfile } from '@/components/profiles-table-columns'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { designTokens } from '@/lib/design-tokens'
import { PageLayout } from '@/components/PageLayout'

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
  const [showProfileInfo, setShowProfileInfo] = useState(false)


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
      <div className={`${designTokens.container.full} ${designTokens.spacing.page.responsive}`}>
        <Card>
          <CardContent className={`${designTokens.spacing.cardContent.responsive} flex items-center justify-center py-12`}>
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
      <div className={`${designTokens.container.full} ${designTokens.spacing.page.responsive}`}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className={`${designTokens.spacing.cardContent.responsive} py-6`}>
            <p className="text-red-600">{error || 'Profile not found'}</p>
            <Link href="/profiles">
              <Button className="mt-4 w-full sm:w-auto" variant="outline">
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
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <span>@{profile.handle}</span>
          {profile.verified && (
            <CheckCircle className="w-5 h-5 text-blue-500" />
          )}
        </div>
      }
      description={`${profile.nickname} • Last updated ${formatDate(profile.updatedAt)}`}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProfileInfo(!showProfileInfo)}
          >
            {showProfileInfo ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            Profile Info
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            TikTok
          </Button>
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/profiles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      }
    >
      <div className="h-full grid grid-rows-[auto_1fr] min-h-0 gap-4">
        {/* Collapsible Profile Info */}
        {showProfileInfo && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Avatar */}
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={`${profile.handle} avatar`}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 w-full">
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
                  )}

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <Users className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                      <div className="text-sm font-bold">{formatNumber(profile.followerCount)}</div>
                      <div className="text-xs text-muted-foreground">Followers</div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <Users className="w-4 h-4 mx-auto mb-1 text-green-500" />
                      <div className="text-sm font-bold">{formatNumber(profile.followingCount)}</div>
                      <div className="text-xs text-muted-foreground">Following</div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <Video className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                      <div className="text-sm font-bold">{formatNumber(profile.videoCount)}</div>
                      <div className="text-xs text-muted-foreground">Videos</div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <Heart className="w-4 h-4 mx-auto mb-1 text-red-500" />
                      <div className="text-sm font-bold">{formatNumber(profile.likeCount)}</div>
                      <div className="text-xs text-muted-foreground">Likes</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts Table - Takes remaining height, filter is inside */}
        {posts.length > 0 ? (
          <div className="min-h-0">
            <PostsTable
              posts={filteredPosts}
              contentTypeFilter={{
                value: contentTypeFilter,
                onChange: setContentTypeFilter
              }}
            />
          </div>
        ) : loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading posts...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No posts found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                No posts have been saved for this profile yet. Use the Profile Explorer to fetch and save posts from @{profile.handle}.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}