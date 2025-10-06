'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Users, Star, Eye, Heart, Video, CheckCircle, User, ArrowRight, MessageCircle, Share2, Bookmark } from 'lucide-react'
import Link from 'next/link'
import { PageLayout } from '@/components/PageLayout'

interface OwnProfile {
  id: string
  handle: string
  nickname: string | null
  avatar: string | null
  bio: string | null
  verified: boolean
  totalPosts: number
  totalViews: string
  totalLikes: string
  totalShares: string
  totalComments: string
  totalSaves: string
  monitoringEnabled: boolean
  lastMonitoringRun: string | null
  createdAt: string
  updatedAt: string
}

export default function MyProfilesPage() {
  const [profiles, setProfiles] = useState<OwnProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOwnProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tiktok/profiles?isOwnProfile=true')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profiles')
      }

      setProfiles(result.profiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(() => {
    fetchOwnProfiles()
  }, [fetchOwnProfiles])

  useEffect(() => {
    fetchOwnProfiles()
  }, [fetchOwnProfiles])

  const formatNumber = (num: string | number): string => {
    const value = typeof num === 'string' ? parseInt(num) : num
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`
    return `${Math.floor(diffInDays / 30)}mo ago`
  }

  // Calculate aggregated stats
  const totalStats = profiles.reduce((acc, profile) => ({
    posts: acc.posts + profile.totalPosts,
    views: acc.views + parseInt(profile.totalViews || '0'),
    likes: acc.likes + parseInt(profile.totalLikes || '0'),
    shares: acc.shares + parseInt(profile.totalShares || '0'),
    comments: acc.comments + parseInt(profile.totalComments || '0'),
  }), { posts: 0, views: 0, likes: 0, shares: 0, comments: 0 })

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          <span>My Profiles</span>
        </div>
      }
      description={`Manage your TikTok profiles (${profiles.length} profile${profiles.length !== 1 ? 's' : ''})`}
      headerActions={
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/profiles">
            <Button variant="default" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Browse All Profiles
            </Button>
          </Link>
        </div>
      }
    >
      {/* Hero Stats Section */}
      {profiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">Total Posts</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.posts)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Total Views</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.views)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">Total Likes</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.likes)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Total Shares</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.shares)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">Total Comments</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.comments)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profiles Grid */}
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : profiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                {/* Profile Header */}
                <div className="flex items-start gap-4 mb-4">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">@{profile.handle}</h3>
                      {profile.verified && (
                        <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    {profile.nickname && (
                      <p className="text-sm text-muted-foreground truncate">{profile.nickname}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {profile.monitoringEnabled ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Monitoring</>
                        ) : (
                          <>Monitoring Off</>
                        )}
                      </Badge>
                      {profile.lastMonitoringRun && (
                        <span className="text-xs text-muted-foreground">
                          Updated {formatDate(profile.lastMonitoringRun)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Bio */}
                {profile.bio && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{profile.bio}</p>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">{formatNumber(profile.totalPosts)}</div>
                    <div className="text-xs text-muted-foreground">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{formatNumber(profile.totalViews)}</div>
                    <div className="text-xs text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{formatNumber(profile.totalLikes)}</div>
                    <div className="text-xs text-muted-foreground">Likes</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link href={`/profiles/${profile.handle}`} className="flex-1">
                    <Button variant="default" className="w-full" size="sm">
                      View Details
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading your profiles...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No profiles marked as yours</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You haven't marked any TikTok profiles as your own yet. Browse all profiles and mark the ones you manage.
            </p>
            <Link href="/profiles">
              <Button variant="default">
                <Users className="w-4 h-4 mr-2" />
                Browse All Profiles
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  )
}
