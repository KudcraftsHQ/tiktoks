'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Play, ScanText, CheckCircle2, XCircle, Clock, Loader2, Bell } from 'lucide-react'
import { PageLayout } from '@/components/PageLayout'
import { toast } from 'sonner'

interface OCRStats {
  totalPhotoPosts: number
  needsOCR: number
  byStatus: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  total: number
}

interface StatsResponse {
  success: boolean
  stats: OCRStats
  queueStats: QueueStats
  error?: string
}

export default function AdminOCRPage() {
  const [stats, setStats] = useState<OCRStats | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [queueing, setQueueing] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)

  const fetchStats = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/admin/ocr/queue-all')
      const result: StatsResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch statistics')
      }

      setStats(result.stats)
      setQueueStats(result.queueStats)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch statistics')
    } finally {
      setLoading(false)
    }
  }

  const queueAllOCRJobs = async () => {
    setQueueing(true)

    try {
      const response = await fetch('/api/admin/ocr/queue-all', {
        method: 'POST'
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to queue OCR jobs')
      }

      toast.success(result.message)

      // Refresh stats after queuing
      await fetchStats()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue OCR jobs')
    } finally {
      setQueueing(false)
    }
  }

  const sendTestNotification = async () => {
    setSendingNotification(true)

    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST'
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test notification')
      }

      toast.success(result.message || 'Test notification sent successfully!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test notification')
    } finally {
      setSendingNotification(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const formatNumber = (num?: number | null): string => {
    if (!num) return '0'
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <PageLayout
      title="OCR Management"
      description="Manage OCR processing for TikTok photo posts"
      headerActions={
        <Button
          onClick={fetchStats}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      }
    >
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 pt-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ScanText className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Total Photo Posts</span>
          </div>
          <div className="text-2xl font-bold">{formatNumber(stats?.totalPhotoPosts)}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <span className="text-sm text-muted-foreground">Needs OCR</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{formatNumber(stats?.needsOCR)}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{formatNumber(stats?.byStatus.completed)}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{formatNumber(stats?.byStatus.failed)}</div>
        </div>
      </div>

      {/* Detailed Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4">
        {/* OCR Status Breakdown */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">OCR Status Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="text-sm font-medium">{stats?.byStatus.pending ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Processing</span>
              <span className="text-sm font-medium">{stats?.byStatus.processing ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-sm font-medium text-green-600">{stats?.byStatus.completed ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Failed</span>
              <span className="text-sm font-medium text-red-600">{stats?.byStatus.failed ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Queue Status */}
        {queueStats && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-4">Queue Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Waiting</span>
                <span className="text-sm font-medium">{queueStats.waiting}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active</span>
                <span className="text-sm font-medium text-blue-600">{queueStats.active}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="text-sm font-medium text-green-600">{queueStats.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="text-sm font-medium text-red-600">{queueStats.failed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Delayed</span>
                <span className="text-sm font-medium">{queueStats.delayed}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Cards */}
      <div className="px-4 pb-4 space-y-4">
        {/* OCR Queue Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-2">Queue All Pending OCR Jobs</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add all photo posts that need OCR processing to the queue. This includes posts with &quot;pending&quot; or &quot;failed&quot; status.
          </p>
          <Button
            onClick={queueAllOCRJobs}
            disabled={queueing || !stats || stats.needsOCR === 0}
            size="lg"
            className="w-full"
          >
            {queueing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Queueing Jobs...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Queue {stats?.needsOCR ?? 0} OCR Jobs
              </>
            )}
          </Button>
          {stats && stats.needsOCR === 0 && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              All photo posts have been processed!
            </p>
          )}
        </div>

        {/* Test Notification Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold mb-2">Test Discord Notification</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Send a test notification to your Discord webhook to verify the integration is working correctly.
          </p>
          <Button
            onClick={sendTestNotification}
            disabled={sendingNotification}
            size="lg"
            className="w-full"
            variant="secondary"
          >
            {sendingNotification ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Test Notification...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Send Test Notification
              </>
            )}
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}
