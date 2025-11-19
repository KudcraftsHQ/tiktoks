'use client'

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ExternalLink,
  User,
  Heart,
  Users,
  Video,
  Eye,
  ArrowUpDown,
  CheckCircle,
  MessageCircle,
  Share2,
  Bookmark,
  Bell,
  BellOff,
  PlayCircle,
  PauseCircle,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react'
// import { createSortableHeader } from '@/components/ui/data-table'
import Link from 'next/link'
import { InlineProfileGroupSelector } from '@/components/InlineProfileGroupSelector'

export interface TikTokProfile {
  id: string
  handle: string
  nickname?: string
  avatar?: string // Resolved avatar URL from avatarId via API
  avatarId?: string // Cache asset ID (for reference, usually not used directly in UI)
  bio?: string
  verified: boolean

  // Group assignment
  profileGroup?: { id: string; name: string } | null

  // Deprecated - kept for backwards compatibility
  followerCount?: number
  followingCount?: number
  videoCount?: number
  likeCount?: number

  // Aggregated metrics from posts
  totalPosts?: number
  totalViews?: string | bigint // BigInt serialized as string
  totalLikes?: string | bigint
  totalShares?: string | bigint
  totalComments?: string | bigint
  totalSaves?: string | bigint

  // Monitoring
  monitoringEnabled: boolean
  lastMonitoringRun?: string | null
  nextMonitoringRun?: string | null

  createdAt: string
  updatedAt: string
  _count?: {
    posts: number
  }
}

interface ProfilesTableColumnsProps {
  onPreviewProfile: (profile: TikTokProfile) => void
  onToggleMonitoring?: (profileId: string, enabled: boolean) => Promise<void>
  onTriggerUpdate?: (profileId: string) => Promise<void>
  onProfileUpdate?: () => void
  onNavigateToProfile?: (handle: string) => void
  selectedProfiles?: Set<string>
  onSelectProfile?: (profileId: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  allSelected?: boolean
}

const formatNumber = (num?: number | string | bigint | null): string => {
  if (!num) return '0'
  const value = typeof num === 'string' ? parseInt(num) : typeof num === 'bigint' ? Number(num) : num
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  // Use user's locale for relative time formatting
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}

const formatDateTime = (dateString: string): { date: string; time: string } => {
  const date = new Date(dateString)

  // Use user's locale for date formatting (will show in their local timezone)
  const dateStr = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)

  const timeStr = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)

  return { date: dateStr, time: timeStr }
}

interface ProfileActionsCellProps {
  profile: TikTokProfile
  onToggleMonitoring?: (profileId: string, enabled: boolean) => Promise<void>
  onTriggerUpdate?: (profileId: string) => Promise<void>
}

function ProfileActionsCell({ profile, onToggleMonitoring, onTriggerUpdate }: ProfileActionsCellProps) {
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleToggleMonitoring = async () => {
    if (!onToggleMonitoring) return
    try {
      await onToggleMonitoring(profile.id, !profile.monitoringEnabled)
    } catch (err) {
      // Error handling is done in parent component
    }
  }

  const handleTriggerUpdate = async () => {
    if (!onTriggerUpdate) return
    setIsUpdating(true)
    try {
      await onTriggerUpdate(profile.id)
    } catch (err) {
      // Error handling is done in parent component
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/profiles/${profile.handle}`} className="cursor-pointer">
              <Eye className="w-4 h-4 mr-2" />
              View Posts
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open on TikTok
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleTriggerUpdate}
            disabled={isUpdating || !onTriggerUpdate}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
            Update Now
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleToggleMonitoring}
            disabled={!onToggleMonitoring}
          >
            {profile.monitoringEnabled ? (
              <>
                <PauseCircle className="w-4 h-4 mr-2" />
                Disable Monitoring
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Enable Monitoring
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export const createProfilesTableColumns = ({
  onPreviewProfile,
  onToggleMonitoring,
  onTriggerUpdate,
  onProfileUpdate,
  onNavigateToProfile,
  selectedProfiles = new Set(),
  onSelectProfile,
  onSelectAll,
  allSelected = false
}: ProfilesTableColumnsProps): ColumnDef<TikTokProfile>[] => [
  {
    accessorKey: 'handle',
    header: 'Handle',
    size: 250,
    meta: { pinned: 'left' },
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div
          className="flex items-center space-x-3 cursor-pointer hover:opacity-70 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            if (onNavigateToProfile) {
              onNavigateToProfile(profile.handle)
            }
          }}
        >
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={`${profile.handle} avatar`}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-1">
              <span className="font-medium">@{profile.handle}</span>
              {profile.verified && (
                <CheckCircle className="w-4 h-4 text-blue-500" />
              )}
            </div>
            {profile.nickname && (
              <div className="text-sm text-muted-foreground">
                {profile.nickname}
              </div>
            )}
          </div>
        </div>
      )
    }
  },
  {
    accessorKey: 'bio',
    header: 'Bio',
    size: 200,
    meta: { pinned: 'left' },
    cell: ({ row }) => {
      const profile = row.original
      return profile.bio ? (
        <div className="max-w-xs truncate text-sm">
          {profile.bio}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">No bio</span>
      )
    }
  },
  {
    accessorKey: 'profileGroup',
    header: 'Group',
    size: 150,
    meta: { pinned: 'left' },
    cell: ({ row }) => {
      const profile = row.original
      return (
        <InlineProfileGroupSelector
          profileId={profile.id}
          currentGroup={profile.profileGroup || null}
          onUpdate={onProfileUpdate}
        />
      )
    }
  },
  {
    accessorKey: 'totalPosts',
    header: 'Posts',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span>{formatNumber(profile.totalPosts)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'totalViews',
    header: 'Views',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span>{formatNumber(profile.totalViews)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'totalLikes',
    header: 'Likes',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span>{formatNumber(profile.totalLikes)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'totalComments',
    header: 'Comments',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span>{formatNumber(profile.totalComments)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'totalShares',
    header: 'Shares',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span>{formatNumber(profile.totalShares)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'totalSaves',
    header: 'Saves',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span>{formatNumber(profile.totalSaves)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'monitoringEnabled',
    header: 'Monitoring',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center justify-center">
          {profile.monitoringEnabled ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">Enabled</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BellOff className="w-4 h-4" />
              <span className="text-sm">Disabled</span>
            </div>
          )}
        </div>
      )
    }
  },
  {
    accessorKey: 'updatedAt',
    header: 'Last Updated',
    cell: ({ row }) => {
      const profile = row.original
      const { date, time } = formatDateTime(profile.updatedAt)
      return (
        <div className="text-sm whitespace-nowrap">
          <div>{date}</div>
          <div className="text-muted-foreground text-xs">{time}</div>
        </div>
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const profile = row.original

      return <ProfileActionsCell
        profile={profile}
        onToggleMonitoring={onToggleMonitoring}
        onTriggerUpdate={onTriggerUpdate}
      />
    },
    size: 80,
    meta: { pinned: 'right' }
  }
]