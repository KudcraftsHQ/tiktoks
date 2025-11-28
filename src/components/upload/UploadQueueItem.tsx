'use client'

import { Loader2, Check, X, AlertCircle, Info, RotateCcw } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { UploadQueueItem as UploadQueueItemType } from '@/lib/indexeddb-helper'

interface UploadQueueItemProps {
  item: UploadQueueItemType
  onRetry?: (itemId: string) => void
  onRemove?: (itemId: string) => void
  onCancel?: (itemId: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function UploadQueueItem({ item, onRetry, onRemove, onCancel }: UploadQueueItemProps) {
  const getStatusIcon = () => {
    switch (item.status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-600" />
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />
      case 'duplicate':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-blue-600" />
              </TooltipTrigger>
              <TooltipContent>
                <p>This image already exists in your library</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (item.status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'duplicate':
        return 'Duplicate - Skipped'
      case 'uploading':
      case 'processing':
        return item.processingStage || 'Uploading...'
      case 'pending':
        return 'Waiting...'
      default:
        return ''
    }
  }

  const showProgress =
    item.status === 'uploading' ||
    item.status === 'processing' ||
    item.status === 'pending'

  const showRetryButton =
    item.status === 'failed' && onRetry && (!item.error?.includes('retrying'))

  const showCancelButton =
    (item.status === 'uploading' || item.status === 'processing' || item.status === 'pending') &&
    onCancel

  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-muted/50 rounded-md group">
      <div className="flex-shrink-0 mt-0.5">{getStatusIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(item.file.size)}
            </p>
          </div>

          {showRetryButton && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              onClick={() => onRetry(item.id)}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}

          {showCancelButton && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-destructive hover:text-destructive"
              onClick={() => onCancel(item.id)}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}

          {onRemove && item.status !== 'completed' && !showCancelButton && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(item.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showProgress && (
          <div className="mt-2 space-y-1">
            <Progress value={item.progress} className="h-1" />
            <p className="text-xs text-muted-foreground">{getStatusText()}</p>
          </div>
        )}

        {item.status === 'failed' && item.error && (
          <p className="text-xs text-red-600 mt-1">{item.error}</p>
        )}

        {item.status === 'completed' && (
          <p className="text-xs text-green-600 mt-1">{getStatusText()}</p>
        )}

        {item.status === 'duplicate' && (
          <p className="text-xs text-blue-600 mt-1">{getStatusText()}</p>
        )}
      </div>
    </div>
  )
}
