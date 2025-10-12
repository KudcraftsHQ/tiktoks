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
  Star,
  Bell,
  BellOff,
  PlayCircle,
  PauseCircle,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react'
import { createSortableHeader } from '@/components/ui/data-table'
import Link from 'next/link'

export interface TikTokProfile {
  id: string
  handle: string
  nickname?: string
  avatar?: string // Resolved avatar URL from avatarId via API
  avatarId?: string // Cache asset ID (for reference, usually not used directly in UI)
  bio?: string
  verified: boolean

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

  // Own profile flag
  isOwnProfile?: boolean

  createdAt: string
  updatedAt: string
  _count?: {
    posts: number
  }
}

interface ProfilesTableColumnsProps {
  onPreviewProfile: (profile: TikTokProfile) => void
  onToggleOwnProfile?: (profileId: string, isOwn: boolean) => Promise<void>
  onToggleMonitoring?: (profileId: string, enabled: boolean) => Promise<void>
  onTriggerUpdate?: (profileId: string) => Promise<void>
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
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
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

interface OwnProfileToggleProps {
  profile: TikTokProfile
  onToggle?: (profileId: string, isOwn: boolean) => Promise<void>
}

function OwnProfileToggle({ profile, onToggle }: OwnProfileToggleProps) {
  const [isToggling, setIsToggling] = React.useState(false)

  const handleToggle = async () => {
    if (!onToggle) return

    setIsToggling(true)
    try {
      await onToggle(profile.id, !profile.isOwnProfile)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <Button
        variant={profile.isOwnProfile ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={isToggling || !onToggle}
        className="gap-1"
      >
        <Star className={`w-3 h-3 ${profile.isOwnProfile ? 'fill-current' : ''}`} />
        {profile.isOwnProfile ? 'Mine' : 'Mark'}
      </Button>
    </div>
  )
}

export const createProfilesTableColumns = ({
  onPreviewProfile,
  onToggleOwnProfile,
  onToggleMonitoring,
  onTriggerUpdate,
  selectedProfiles = new Set(),
  onSelectProfile,
  onSelectAll,
  allSelected = false
}: ProfilesTableColumnsProps): ColumnDef<TikTokProfile>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => {
            onSelectAll?.(checked === true)
          }}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedProfiles.has(profile.id)}
            onCheckedChange={(checked) => {
              onSelectProfile?.(profile.id, checked === true)
            }}
            aria-label={`Select ${profile.handle}`}
          />
        </div>
      )
    },
    size: 50,
    meta: { pinned: 'left' }
  },
  {
    accessorKey: 'handle',
    header: createSortableHeader('Handle'),
    size: 250,
    meta: { pinned: 'left' },
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-3">
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
    accessorKey: 'totalPosts',
    header: createSortableHeader('Posts'),
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
    header: createSortableHeader('Views'),
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
    header: createSortableHeader('Likes'),
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
    header: createSortableHeader('Comments'),
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
    header: createSortableHeader('Shares'),
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
    header: createSortableHeader('Saves'),
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
    header: createSortableHeader('Last Updated'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="text-center">
          <span className="text-sm text-muted-foreground">
            {formatDate(profile.updatedAt)}
          </span>
        </div>
      )
    }
  },
  {
    accessorKey: 'isOwnProfile',
    header: 'Own Profile',
    cell: ({ row }) => {
      const profile = row.original

      return (
        <OwnProfileToggle profile={profile} onToggle={onToggleOwnProfile} />
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