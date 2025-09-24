'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ExternalLink,
  User,
  Heart,
  Users,
  Video,
  Eye,
  ArrowUpDown,
  CheckCircle
} from 'lucide-react'
import { createSortableHeader } from '@/components/ui/data-table'
import Link from 'next/link'

export interface TikTokProfile {
  id: string
  handle: string
  nickname?: string
  avatar?: string
  bio?: string
  verified: boolean
  followerCount?: number
  followingCount?: number
  videoCount?: number
  likeCount?: number
  createdAt: string
  updatedAt: string
  _count: {
    posts: number
  }
}

interface ProfilesTableColumnsProps {
  onPreviewProfile: (profile: TikTokProfile) => void
}

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

export const createProfilesTableColumns = ({
  onPreviewProfile
}: ProfilesTableColumnsProps): ColumnDef<TikTokProfile>[] => [
  {
    accessorKey: 'avatar',
    header: '',
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center justify-center">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={`${profile.handle} avatar`}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
      )
    }
  },
  {
    accessorKey: 'handle',
    header: createSortableHeader('Handle'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-2">
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
    accessorKey: 'followerCount',
    header: createSortableHeader('Followers'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span>{formatNumber(profile.followerCount)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'followingCount',
    header: createSortableHeader('Following'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-1">
          <User className="w-4 h-4 text-muted-foreground" />
          <span>{formatNumber(profile.followingCount)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'videoCount',
    header: createSortableHeader('Videos'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-1">
          <Video className="w-4 h-4 text-muted-foreground" />
          <span>{formatNumber(profile.videoCount)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'likeCount',
    header: createSortableHeader('Likes'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-1">
          <Heart className="w-4 h-4 text-red-500" />
          <span>{formatNumber(profile.likeCount)}</span>
        </div>
      )
    }
  },
  {
    accessorKey: '_count.posts',
    header: createSortableHeader('Saved Posts'),
    cell: ({ row }) => {
      const profile = row.original
      return (
        <div className="flex items-center space-x-1">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span>{formatNumber(profile._count.posts)}</span>
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
        <span className="text-sm text-muted-foreground">
          {formatDate(profile.updatedAt)}
        </span>
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const profile = row.original

      return (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
            title="Open on TikTok"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>

          <Link href={`/profiles/${profile.id}`}>
            <Button
              variant="default"
              size="sm"
              title="View Posts"
            >
              <Eye className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )
    }
  }
]