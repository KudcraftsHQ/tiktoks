'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { UploadManager } from './upload-manager'
import type { UploadQueueItem } from './indexeddb-helper'
import { toast } from 'sonner'

interface UploadContextValue {
  queue: UploadQueueItem[]
  addFiles: (files: File[], folderId?: string | null) => Promise<void>
  retryUpload: (itemId: string) => Promise<void>
  removeFromQueue: (itemId: string) => Promise<void>
  cancelUpload: (itemId: string) => Promise<void>
  cancelAllUploads: () => Promise<void>
  clearCompleted: () => Promise<void>
  isUploading: boolean
  isPanelOpen: boolean
  setIsPanelOpen: (open: boolean) => void
}

const UploadContext = createContext<UploadContextValue | null>(null)

export function useUpload() {
  const context = useContext(UploadContext)
  if (!context) {
    throw new Error('useUpload must be used within UploadContextProvider')
  }
  return context
}

export function UploadContextProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const managerRef = useRef<UploadManager | null>(null)
  const hasWarnedRef = useRef(false)

  // Initialize upload manager
  useEffect(() => {
    const manager = new UploadManager({
      onProgress: (itemId, progress, stage) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, progress, processingStage: stage }
              : item
          )
        )
      },
      onComplete: (itemId, result) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  assetId: result.id,
                  assetUrl: result.url,
                  uploadedAt: new Date(),
                }
              : item
          )
        )

        // Emit custom event for AssetsPage to listen to
        window.dispatchEvent(
          new CustomEvent('asset-uploaded', {
            detail: result,
          })
        )
      },
      onError: (itemId, error, code) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, error, status: 'failed' } : item
          )
        )

        toast.error('Upload failed', {
          description: error,
        })
      },
      onStatusChange: (itemId, status) => {
        setQueue((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, status } : item))
        )
      },
    })

    managerRef.current = manager

    // Initialize and load persisted queue
    manager.initialize().then(() => {
      setQueue(manager.getQueue())
    })

    // Cleanup on unmount
    return () => {
      manager.cleanup()
    }
  }, [])

  // Sync queue with manager
  useEffect(() => {
    if (managerRef.current) {
      const managerQueue = managerRef.current.getQueue()
      if (JSON.stringify(queue) !== JSON.stringify(managerQueue)) {
        setQueue(managerQueue)
      }
    }
  }, [queue])

  // Auto-open panel when uploads start
  useEffect(() => {
    if (queue.length > 0 && !isPanelOpen) {
      setIsPanelOpen(true)
    }
  }, [queue.length, isPanelOpen])

  // Warn user before leaving if uploads in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasActiveUploads = queue.some(
        (item) =>
          item.status === 'pending' ||
          item.status === 'uploading' ||
          item.status === 'processing'
      )

      if (hasActiveUploads && !hasWarnedRef.current) {
        e.preventDefault()
        e.returnValue = 'Uploads in progress. Are you sure you want to leave?'
        hasWarnedRef.current = true
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [queue])

  const addFiles = useCallback(
    async (files: File[], folderId?: string | null) => {
      if (!managerRef.current) return

      const itemIds = await managerRef.current.enqueueFiles(files, folderId)
      setQueue(managerRef.current.getQueue())

      toast.success('Files added to upload queue', {
        description: `${files.length} file(s) will be uploaded`,
      })
    },
    []
  )

  const retryUpload = useCallback(async (itemId: string) => {
    if (!managerRef.current) return

    await managerRef.current.retryUpload(itemId)
    setQueue(managerRef.current.getQueue())
  }, [])

  const removeFromQueue = useCallback(async (itemId: string) => {
    if (!managerRef.current) return

    await managerRef.current.removeFromQueue(itemId)
    setQueue(managerRef.current.getQueue())
  }, [])

  const cancelUpload = useCallback(async (itemId: string) => {
    if (!managerRef.current) return

    await managerRef.current.cancelUpload(itemId)
    setQueue(managerRef.current.getQueue())
  }, [])

  const cancelAllUploads = useCallback(async () => {
    if (!managerRef.current) return

    await managerRef.current.cancelAllUploads()
    setQueue(managerRef.current.getQueue())

    toast.info('All uploads cancelled')
  }, [])

  const clearCompleted = useCallback(async () => {
    if (!managerRef.current) return

    await managerRef.current.clearCompleted()
    setQueue(managerRef.current.getQueue())
  }, [])

  const isUploading = queue.some(
    (item) =>
      item.status === 'pending' ||
      item.status === 'uploading' ||
      item.status === 'processing'
  )

  return (
    <UploadContext.Provider
      value={{
        queue,
        addFiles,
        retryUpload,
        removeFromQueue,
        cancelUpload,
        cancelAllUploads,
        clearCompleted,
        isUploading,
        isPanelOpen,
        setIsPanelOpen,
      }}
    >
      {children}
    </UploadContext.Provider>
  )
}
