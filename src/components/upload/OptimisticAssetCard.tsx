'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UploadQueueItem } from '@/lib/indexeddb-helper'

interface OptimisticAssetCardProps {
  item: UploadQueueItem
}

export function OptimisticAssetCard({ item }: OptimisticAssetCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Create object URL for preview
  useEffect(() => {
    const url = URL.createObjectURL(item.file)
    setPreviewUrl(url)

    // Cleanup on unmount
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [item.file])

  const getStatusBadge = () => {
    switch (item.status) {
      case 'uploading':
        return (
          <Badge variant="secondary" className="absolute top-2 right-2">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Uploading {item.progress}%
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary" className="absolute top-2 right-2">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing {item.progress}%
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="default" className="absolute top-2 right-2 bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="absolute top-2 right-2">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case 'duplicate':
        return (
          <Badge variant="secondary" className="absolute top-2 right-2 bg-blue-600 text-white">
            <Info className="h-3 w-3 mr-1" />
            Duplicate
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="absolute top-2 right-2">
            Pending
          </Badge>
        )
    }
  }

  const showOverlay =
    item.status === 'uploading' ||
    item.status === 'processing' ||
    item.status === 'pending'

  return (
    <div
      className={cn(
        'group relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted',
        item.status === 'failed' && 'border-red-500'
      )}
    >
      {previewUrl && (
        <img
          src={previewUrl}
          alt={item.fileName}
          className={cn(
            'h-full w-full object-contain',
            showOverlay && 'opacity-50'
          )}
        />
      )}

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
            <p className="text-xs text-white font-medium">{item.progress}%</p>
            {item.processingStage && (
              <p className="text-xs text-white/80 mt-1">{item.processingStage}</p>
            )}
          </div>
        </div>
      )}

      {item.status === 'failed' && item.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-xs text-white">{item.error}</p>
          </div>
        </div>
      )}

      {getStatusBadge()}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="text-xs text-white truncate">{item.fileName}</p>
      </div>
    </div>
  )
}
