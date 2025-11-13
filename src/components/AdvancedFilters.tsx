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
import { Filter, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AdvancedFiltersValue {
  accountIds: string[]
  viewCountGt?: number
  viewCountLt?: number
}

interface Profile {
  id: string
  handle: string
  nickname: string | null
  avatarUrl: string | null
  postCount: number
}

interface AdvancedFiltersProps {
  value: AdvancedFiltersValue
  onChange: (value: AdvancedFiltersValue) => void
}

export function AdvancedFilters({ value, onChange }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [localFilters, setLocalFilters] = useState<AdvancedFiltersValue>(value)

  // Fetch profiles on mount
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

    fetchProfiles()
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

  const handleApply = () => {
    onChange(localFilters)
    setIsOpen(false)
  }

  const handleReset = () => {
    const resetFilters: AdvancedFiltersValue = {
      accountIds: [],
      viewCountGt: undefined,
      viewCountLt: undefined
    }
    setLocalFilters(resetFilters)
    onChange(resetFilters)
  }

  const activeFilterCount =
    localFilters.accountIds.length +
    (localFilters.viewCountGt ? 1 : 0) +
    (localFilters.viewCountLt ? 1 : 0)

  const selectedProfiles = profiles.filter(p => localFilters.accountIds.includes(p.id))

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
