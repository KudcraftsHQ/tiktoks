'use client'

import { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUpload } from '@/lib/upload-context'
import { UploadQueueItem } from './UploadQueueItem'
import { cn } from '@/lib/utils'

export function UploadProgressPanel() {
  const {
    queue,
    clearCompleted,
    retryUpload,
    removeFromQueue,
    cancelUpload,
    cancelAllUploads,
    isPanelOpen,
    setIsPanelOpen,
  } = useUpload()
  const [isMinimized, setIsMinimized] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // Show panel when there are items in queue
  useEffect(() => {
    if (queue.length > 0) {
      setShouldRender(true)
    } else {
      // Keep panel visible for 5 seconds after queue empties
      const timeout = setTimeout(() => {
        setShouldRender(false)
        setIsMinimized(false)
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [queue.length])

  // Auto-open panel when uploads start
  useEffect(() => {
    if (queue.length > 0 && !isPanelOpen) {
      setIsPanelOpen(true)
      setIsMinimized(false)
    }
  }, [queue.length, isPanelOpen, setIsPanelOpen])

  if (!shouldRender || !isPanelOpen) return null

  const activeUploads = queue.filter(
    (item) =>
      item.status === 'pending' ||
      item.status === 'uploading' ||
      item.status === 'processing'
  )
  const failedUploads = queue.filter((item) => item.status === 'failed')
  const duplicateUploads = queue.filter((item) => item.status === 'duplicate')
  const completedUploads = queue.filter((item) => item.status === 'completed')

  const totalUploads = queue.length
  const activeCount = activeUploads.length
  const failedCount = failedUploads.length
  const duplicateCount = duplicateUploads.length
  const completedCount = completedUploads.length

  const getHeaderText = () => {
    if (activeCount > 0) {
      const parts = [`Uploading ${completedCount + duplicateCount} of ${totalUploads} items`]
      if (failedCount > 0) parts.push(`${failedCount} failed`)
      if (duplicateCount > 0) parts.push(`${duplicateCount} duplicate`)
      return parts.join(', ')
    } else if (completedCount > 0 || duplicateCount > 0) {
      const parts = [`${completedCount} completed`]
      if (duplicateCount > 0) parts.push(`${duplicateCount} duplicate`)
      if (failedCount > 0) parts.push(`${failedCount} failed`)
      return parts.join(', ')
    } else if (failedCount > 0) {
      return `${failedCount} failed`
    }
    return 'Upload queue'
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-96 bg-background border rounded-lg shadow-xl',
        'transition-all duration-200 ease-in-out'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getHeaderText()}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={cancelAllUploads}
            >
              Cancel All
            </Button>
          )}

          {(completedCount > 0 || duplicateCount > 0) && activeCount === 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={clearCompleted}
            >
              Clear
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setIsPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <ScrollArea className="max-h-96">
          <div className="p-1">
            {queue.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No uploads in queue
              </div>
            ) : (
              <div className="space-y-1">
                {queue.map((item) => (
                  <UploadQueueItem
                    key={item.id}
                    item={item}
                    onRetry={retryUpload}
                    onRemove={removeFromQueue}
                    onCancel={cancelUpload}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
