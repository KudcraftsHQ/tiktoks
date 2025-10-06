'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { createProfilesTableColumns, TikTokProfile } from '@/components/profiles-table-columns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Users, Heart, Video, CheckCircle } from 'lucide-react'

interface ProfilesTableProps {
  profiles: TikTokProfile[]
  onProfilesChange?: () => void
}

export function ProfilesTable({ profiles, onProfilesChange }: ProfilesTableProps) {
  const router = useRouter()
  const [selectedProfile, setSelectedProfile] = useState<TikTokProfile | null>(null)

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

  const handlePreviewProfile = (profile: TikTokProfile) => {
    setSelectedProfile(profile)
  }

  const handleRowClick = (profile: TikTokProfile) => {
    router.push(`/profiles/${profile.handle}`)
  }

  const handleToggleOwnProfile = async (profileId: string, isOwn: boolean) => {
    try {
      const response = await fetch(`/api/tiktok/profiles/${profileId}/own`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isOwnProfile: isOwn })
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      // Trigger parent refresh
      if (onProfilesChange) {
        onProfilesChange()
      }
    } catch (err) {
      console.error('Failed to toggle own profile:', err)
      throw err
    }
  }

  // Create columns with handlers
  const columns = useMemo(() => createProfilesTableColumns({
    onPreviewProfile: handlePreviewProfile,
    onToggleOwnProfile: handleToggleOwnProfile
  }), [onProfilesChange])

  return (
    <>
      <DataTable
        columns={columns}
        data={profiles}
        searchKey="handle"
        searchPlaceholder="Search profiles..."
        showPagination={false}
        onRowClick={handleRowClick}
      />

      {/* Profile Preview Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>@{selectedProfile?.handle}</span>
              {selectedProfile?.verified && (
                <CheckCircle className="w-5 h-5 text-blue-500" />
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedProfile?.nickname} • Last updated {selectedProfile ? formatDate(selectedProfile.updatedAt) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && (
            <div className="space-y-6">
              {/* Profile Avatar and Basic Info */}
              <div className="flex items-start space-x-4">
                {selectedProfile.avatar ? (
                  <img
                    src={selectedProfile.avatar}
                    alt={`${selectedProfile.handle} avatar`}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://www.tiktok.com/@${selectedProfile.handle}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on TikTok
                    </Button>
                  </div>

                  {selectedProfile.bio && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedProfile.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(selectedProfile.followerCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                </div>

                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Users className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(selectedProfile.followingCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>

                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Video className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(selectedProfile.videoCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Videos</div>
                </div>

                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <Heart className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <div className="text-2xl font-bold">
                    {formatNumber(selectedProfile.likeCount)}
                  </div>
                  <div className="text-sm text-muted-foreground">Likes</div>
                </div>
              </div>

              {/* Saved Posts Info */}
              <div className="border-t pt-4">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-1">
                    {formatNumber(selectedProfile._count.posts)} posts saved
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Posts from this profile in your database
                  </p>
                  <Button asChild>
                    <a href={`/profiles/${selectedProfile.handle}`}>
                      View All Posts
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}