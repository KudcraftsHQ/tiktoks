'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ProfilesTable } from '@/components/ProfilesTable'
import { Button } from '@/components/ui/button'
import { RefreshCw, Users } from 'lucide-react'
import { TikTokProfile } from '@/components/profiles-table-columns'
import { PageLayout } from '@/components/PageLayout'

interface ProfilesResult {
  profiles: TikTokProfile[]
  hasMore: boolean
  total: number
  page: number
  limit: number
  error?: string
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<TikTokProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalProfiles, setTotalProfiles] = useState(0)


  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tiktok/profiles?limit=100')
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
  }, [])

  const handleRefresh = useCallback(() => {
    fetchProfiles()
  }, [fetchProfiles])

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

  return (
    <PageLayout
      title="TikTok Profiles"
      description={`Browse and analyze TikTok profiles in your database (${formatNumber(totalProfiles)} total)`}
      headerActions={
        <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : profiles.length > 0 ? (
        <ProfilesTable profiles={profiles} />
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading profiles...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No profiles found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No TikTok profiles have been saved yet. Use the Profile Explorer to fetch and save profiles.
            </p>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  )
}