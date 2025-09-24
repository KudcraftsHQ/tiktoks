'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfilesTable } from '@/components/ProfilesTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  Users,
  Search,
  Filter,
  CheckCircle,
  X
} from 'lucide-react'
import { TikTokProfile } from '@/components/profiles-table-columns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProfilesResult {
  profiles: TikTokProfile[]
  hasMore: boolean
  total: number
  page: number
  limit: number
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<TikTokProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [followerRangeFilter, setFollowerRangeFilter] = useState<'all' | 'micro' | 'macro' | 'mega'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProfiles, setTotalProfiles] = useState(0)


  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      if (verifiedFilter !== 'all') {
        params.append('verified', verifiedFilter === 'verified' ? 'true' : 'false')
      }

      // Add follower range filters
      if (followerRangeFilter === 'micro') {
        params.append('minFollowers', '1000')
        params.append('maxFollowers', '100000')
      } else if (followerRangeFilter === 'macro') {
        params.append('minFollowers', '100000')
        params.append('maxFollowers', '1000000')
      } else if (followerRangeFilter === 'mega') {
        params.append('minFollowers', '1000000')
      }

      const response = await fetch(`/api/tiktok/profiles?${params.toString()}`)
      const result: ProfilesResult = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profiles')
      }

      setProfiles(result.profiles)
      setTotalProfiles(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, verifiedFilter, followerRangeFilter])

  const handleRefresh = useCallback(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleSearch = useCallback(() => {
    setCurrentPage(1)
    fetchProfiles()
  }, [fetchProfiles])

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setVerifiedFilter('all')
    setFollowerRangeFilter('all')
    setCurrentPage(1)
  }, [])

  // Load profiles on mount and when filters change
  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const activeFiltersCount = [
    searchTerm,
    verifiedFilter !== 'all' ? verifiedFilter : null,
    followerRangeFilter !== 'all' ? followerRangeFilter : null
  ].filter(Boolean).length

  return (
    <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">TikTok Profiles</h1>
            <p className="text-muted-foreground">
              Browse and analyze TikTok profiles in your database ({formatNumber(totalProfiles)} total)
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary">
                    {activeFiltersCount} active
                  </Badge>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Handle, nickname, or bio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} size="icon" variant="outline">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Verification</label>
                <Select value={verifiedFilter} onValueChange={(value: any) => setVerifiedFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All profiles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All profiles</SelectItem>
                    <SelectItem value="verified">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                        <span>Verified only</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="unverified">Unverified only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Follower Range</label>
                <Select value={followerRangeFilter} onValueChange={(value: any) => setFollowerRangeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All ranges" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ranges</SelectItem>
                    <SelectItem value="micro">Micro (1K - 100K)</SelectItem>
                    <SelectItem value="macro">Macro (100K - 1M)</SelectItem>
                    <SelectItem value="mega">Mega (1M+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <div className="flex space-x-2">
                  <Button onClick={handleSearch} className="flex-1">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {profiles.length > 0 && (
          <Card>
            <CardContent>
              <ProfilesTable profiles={profiles} />
            </CardContent>
          </Card>
        )}

        {loading && profiles.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading profiles...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && profiles.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No profiles found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {activeFiltersCount > 0
                  ? "No profiles match your current filters. Try adjusting or clearing your filters."
                  : "No TikTok profiles have been saved yet. Use the Profile Explorer to fetch and save profiles."}
              </p>
              {activeFiltersCount > 0 && (
                <Button onClick={clearFilters} className="mt-4" variant="outline">
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  )
}