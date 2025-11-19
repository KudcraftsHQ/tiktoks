'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filter, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AdvancedFiltersValue {
  accountIds: string[]
  profileGroupIds: string[]
  viewCountGt?: number
  viewCountLt?: number
  ocrStatus?: 'all' | 'processed' | 'unprocessed'
}

interface Profile {
  id: string
  handle: string
  nickname: string | null
  avatarUrl: string | null
  postCount: number
}

interface ProfileGroup {
  id: string
  name: string
  description: string | null
  profileCount: number
}

interface AdvancedFiltersProps {
  value: AdvancedFiltersValue
  onChange: (value: AdvancedFiltersValue) => void
}

export function AdvancedFilters({ value, onChange }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileGroups, setProfileGroups] = useState<ProfileGroup[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [isLoadingProfileGroups, setIsLoadingProfileGroups] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [localFilters, setLocalFilters] = useState<AdvancedFiltersValue>(value)

  // Fetch profiles and profile groups on mount
  useEffect(() => {
    const fetchProfiles = async () => {
      setIsLoadingProfiles(true)
      try {
        const response = await fetch('/api/tiktok/profiles?limit=100')
        const data = await response.json()
        setProfiles(data.profiles || [])
      } catch (error) {
        console.error('Failed to fetch profiles:', error)
      } finally {
        setIsLoadingProfiles(false)
      }
    }

    const fetchProfileGroups = async () => {
      setIsLoadingProfileGroups(true)
      try {
        const response = await fetch('/api/profile-groups')
        const data = await response.json()
        if (data.success) {
          setProfileGroups(data.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch profile groups:', error)
      } finally {
        setIsLoadingProfileGroups(false)
      }
    }

    fetchProfiles()
    fetchProfileGroups()
  }, [])

  // Update local filters when prop changes
  useEffect(() => {
    setLocalFilters(value)
  }, [value])

  const filteredProfiles = profiles.filter(profile => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      profile.handle.toLowerCase().includes(query) ||
      profile.nickname?.toLowerCase().includes(query)
    )
  })

  const toggleAccount = (accountId: string) => {
    setLocalFilters(prev => {
      const isSelected = prev.accountIds.includes(accountId)
      return {
        ...prev,
        accountIds: isSelected
          ? prev.accountIds.filter(id => id !== accountId)
          : [...prev.accountIds, accountId]
      }
    })
  }

  const toggleProfileGroup = (groupId: string) => {
    setLocalFilters(prev => {
      const isSelected = prev.profileGroupIds.includes(groupId)
      return {
        ...prev,
        profileGroupIds: isSelected
          ? prev.profileGroupIds.filter(id => id !== groupId)
          : [...prev.profileGroupIds, groupId]
      }
    })
  }

  const handleApply = () => {
    onChange(localFilters)
    setIsOpen(false)
  }

  const handleReset = () => {
    const resetFilters: AdvancedFiltersValue = {
      accountIds: [],
      profileGroupIds: [],
      viewCountGt: undefined,
      viewCountLt: undefined,
      ocrStatus: 'all'
    }
    setLocalFilters(resetFilters)
    onChange(resetFilters)
  }

  const activeFilterCount =
    localFilters.accountIds.length +
    localFilters.profileGroupIds.length +
    (localFilters.viewCountGt ? 1 : 0) +
    (localFilters.viewCountLt ? 1 : 0) +
    (localFilters.ocrStatus && localFilters.ocrStatus !== 'all' ? 1 : 0)

  const selectedProfiles = profiles.filter(p => localFilters.accountIds.includes(p.id))
  const selectedProfileGroups = profileGroups.filter(g => localFilters.profileGroupIds.includes(g.id))

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            className="h-8 px-3 text-xs gap-1.5"
          >
            <Filter className="h-3 w-3" />
          </Button>
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute -right-1.5 -bottom-1.5 h-4 w-4 flex items-center justify-center rounded-full p-0 text-[10px] border border-background"
            >
              {activeFilterCount}
            </Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px]" align="end">
        <div className="space-y-4">
          {/* Profile Groups Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Account Groups</Label>

            {localFilters.profileGroupIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProfileGroups.map(group => (
                  <Badge
                    key={group.id}
                    variant="secondary"
                    className="gap-1 pr-2"
                  >
                    <span className="text-xs">{group.name}</span>
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => toggleProfileGroup(group.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-[120px] border rounded-md">
              <div className="p-2">
                {isLoadingProfileGroups ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    Loading groups...
                  </div>
                ) : profileGroups.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    No groups found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {profileGroups.map(group => {
                      const isSelected = localFilters.profileGroupIds.includes(group.id)
                      return (
                        <div
                          key={group.id}
                          onClick={() => toggleProfileGroup(group.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            "hover:bg-accent",
                            isSelected && "bg-accent"
                          )}
                        >
                          <div className={cn(
                            "h-3.5 w-3.5 border rounded flex items-center justify-center shrink-0",
                            isSelected && "bg-primary border-primary"
                          )}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {group.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {group.profileCount} profiles
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Accounts Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Accounts</Label>
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />

            {localFilters.accountIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProfiles.map(profile => (
                  <Badge
                    key={profile.id}
                    variant="secondary"
                    className="gap-1 pr-2"
                  >
                    <span className="text-xs">@{profile.handle}</span>
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => toggleAccount(profile.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-[200px] border rounded-md">
              <div className="p-2">
                {isLoadingProfiles ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    Loading accounts...
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    No accounts found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProfiles.map(profile => {
                      const isSelected = localFilters.accountIds.includes(profile.id)
                      return (
                        <div
                          key={profile.id}
                          onClick={() => toggleAccount(profile.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            "hover:bg-accent",
                            isSelected && "bg-accent"
                          )}
                        >
                          <div className={cn(
                            "h-3.5 w-3.5 border rounded flex items-center justify-center shrink-0",
                            isSelected && "bg-primary border-primary"
                          )}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          {profile.avatarUrl && (
                            <img
                              src={profile.avatarUrl}
                              alt={profile.handle}
                              className="h-6 w-6 rounded-full"
                            />
                          )}
                          {!profile.avatarUrl && (
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                              {profile.handle[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {profile.nickname || profile.handle}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              @{profile.handle} · {profile.postCount} posts
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* View Count Filters */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">View Count</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="viewCountGt" className="text-xs text-muted-foreground">
                  Minimum
                </Label>
                <Input
                  id="viewCountGt"
                  type="number"
                  placeholder="e.g., 1000"
                  value={localFilters.viewCountGt || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    viewCountGt: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="viewCountLt" className="text-xs text-muted-foreground">
                  Maximum
                </Label>
                <Input
                  id="viewCountLt"
                  type="number"
                  placeholder="e.g., 100000"
                  value={localFilters.viewCountLt || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    viewCountLt: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* OCR Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">OCR Status</Label>
            <Select
              value={localFilters.ocrStatus || 'all'}
              onValueChange={(value) => setLocalFilters(prev => ({
                ...prev,
                ocrStatus: value as 'all' | 'processed' | 'unprocessed'
              }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All posts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All posts</SelectItem>
                <SelectItem value="processed">OCR processed</SelectItem>
                <SelectItem value="unprocessed">OCR not processed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-8 text-xs"
            >
              Reset
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 h-8 text-xs"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
