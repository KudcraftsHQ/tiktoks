'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  User,
  Activity,
  Play,
  ChevronLeft,
} from 'lucide-react'
import { TikTokProfile } from '@/components/profiles-table-columns'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { designTokens } from '@/lib/design-tokens'
import { PageLayout } from '@/components/PageLayout'
import { PostsPageContent } from '@/components/PostsPageContent'

function ProfileDetailPageContent() {
  const params = useParams()
  const handle = params.handle as string

  const [profile, setProfile] = useState<TikTokProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monitoringEnabled, setMonitoringEnabled] = useState(false)
  const [monitoringLoading, setMonitoringLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!handle) return

    setProfileLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/by-handle/${handle}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile')
      }

      setProfile(result)
      setMonitoringEnabled(result.monitoringEnabled || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile')
    } finally {
      setProfileLoading(false)
    }
  }, [handle])

  const handleMonitoringToggle = useCallback(async (enabled: boolean) => {
    if (!profile?.id) return

    setMonitoringLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profile.id}/monitoring`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      })

      if (!response.ok) {
        throw new Error('Failed to update monitoring status')
      }

      const result = await response.json()
      setMonitoringEnabled(result.profile.monitoringEnabled)

      toast.success(enabled ? 'Monitoring enabled' : 'Monitoring disabled', {
        description: enabled ? 'Profile will be monitored every 24 hours' : 'Automatic monitoring stopped'
      })

      // Refresh profile to get updated monitoring info
      fetchProfile()
    } catch (err) {
      console.error('Failed to toggle monitoring:', err)
      toast.error('Failed to update monitoring status')
      // Revert the switch on error
      setMonitoringEnabled(!enabled)
    } finally {
      setMonitoringLoading(false)
    }
  }, [profile?.id, fetchProfile])

  const handleManualTrigger = useCallback(async () => {
    if (!profile?.id) return

    setTriggerLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profile.id}/monitoring/trigger`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to trigger monitoring')
      }

      toast.success('Monitoring queued', {
        description: 'Profile update has been queued and will be processed shortly'
      })
    } catch (err) {
      console.error('Failed to trigger monitoring:', err)
      toast.error('Failed to queue monitoring', {
        description: 'Please try again later'
      })
    } finally {
      setTriggerLoading(false)
    }
  }, [profile?.id])

  // Load profile on mount
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  if (profileLoading) {
    return (
      <PageLayout
        title={
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          </div>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          </div>
        }
      >
        <div className="h-full flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading profile...</span>
          </div>
        </div>
      </PageLayout>
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

  // Build title element with profile info
  const titleElement = (
    <div className="flex items-center gap-2">
      <Link href="/profiles">
        <Button variant="secondary" size="icon" className="rounded-full">
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </Link>
      {profile.avatar ? (
        <img
          src={profile.avatar}
          alt={`${profile.handle} avatar`}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <span>@{profile.handle}</span>
      {profile.verified && (
        <CheckCircle className="w-5 h-5 text-blue-500" />
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
      >
        <ExternalLink className="w-4 h-4" />
      </Button>
    </div>
  )

  // Build additional header actions for monitoring controls
  const additionalHeaderActions = (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <Label htmlFor="monitoring-switch" className="text-sm cursor-pointer">
          Monitor
        </Label>
        <Switch
          id="monitoring-switch"
          checked={monitoringEnabled}
          onCheckedChange={handleMonitoringToggle}
          disabled={monitoringLoading}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleManualTrigger}
        disabled={triggerLoading}
        className="h-8 px-3 text-xs"
      >
        <Play className={`w-3 h-3 mr-1.5 ${triggerLoading ? 'animate-spin' : ''}`} />
        Update Now
      </Button>
      <Button
        onClick={fetchProfile}
        disabled={profileLoading}
        variant="outline"
        size="sm"
        className="h-8 px-3 text-xs"
      >
        <RefreshCw className={`w-3 h-3 mr-1.5 ${profileLoading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </>
  )

  return (
    <PostsPageContent
      profileId={profile.id}
      profileHandle={handle}
      titleElement={titleElement}
      additionalHeaderActions={additionalHeaderActions}
    />
  )
}

export default function ProfileDetailPage() {
  return (
    <Suspense fallback={
      <PageLayout title="Profile" description="Loading profile...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    }>
      <ProfileDetailPageContent />
    </Suspense>
  )
}
