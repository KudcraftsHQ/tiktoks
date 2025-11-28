import type { UploadQueueItem } from './indexeddb-helper'
import { uploadQueueDB } from './indexeddb-helper'

export interface UploadCallbacks {
  onProgress: (itemId: string, progress: number, stage?: string) => void
  onComplete: (itemId: string, result: any) => void
  onError: (itemId: string, error: string, code: string) => void
  onStatusChange: (itemId: string, status: UploadQueueItem['status']) => void
}

export class UploadManager {
  private queue: UploadQueueItem[] = []
  private activeUploads = new Map<string, AbortController>()
  private readonly maxConcurrent = 5
  private callbacks: UploadCallbacks
  private processing = false

  constructor(callbacks: UploadCallbacks) {
    this.callbacks = callbacks
  }

  async initialize() {
    // Load persisted queue from IndexedDB
    try {
      const savedQueue = await uploadQueueDB.loadQueue()
      // Filter out completed/failed items older than session
      const pendingQueue = savedQueue.filter(
        (item) =>
          item.status === 'pending' ||
          item.status === 'uploading' ||
          item.status === 'processing'
      )

      // Verify file access for all pending items
      const accessibleItems: UploadQueueItem[] = []
      for (const item of pendingQueue) {
        try {
          // Try to access the file
          await item.file.arrayBuffer()
          // Reset status to pending (in case it was stuck in uploading/processing)
          item.status = 'pending'
          accessibleItems.push(item)
        } catch (fileError) {
          // File no longer accessible - skip it
          console.warn(
            `Skipping inaccessible file from persisted queue: ${item.fileName}`,
            fileError
          )
        }
      }

      this.queue = accessibleItems

      // Resume processing if there are accessible items
      if (this.queue.length > 0) {
        await uploadQueueDB.saveQueue(this.queue)
        this.processQueue()
      }
    } catch (error) {
      console.error('Failed to load upload queue from IndexedDB:', error)
    }
  }

  async enqueueFiles(files: File[], folderId?: string | null) {
    const newItems: UploadQueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      folderId: folderId || null,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      uploadedAt: undefined,
    }))

    this.queue.push(...newItems)
    await this.saveToIndexedDB()
    this.processQueue()

    return newItems.map((item) => item.id)
  }

  async retryUpload(itemId: string) {
    const item = this.queue.find((i) => i.id === itemId)
    if (!item) return

    // Reset item state
    item.status = 'pending'
    item.error = undefined
    item.progress = 0
    item.processingStage = undefined
    item.retryCount = (item.retryCount || 0) + 1

    this.callbacks.onStatusChange(itemId, 'pending')
    await this.saveToIndexedDB()

    // Re-trigger processing
    this.processQueue()
  }

  async removeFromQueue(itemId: string) {
    // Cancel if actively uploading
    const controller = this.activeUploads.get(itemId)
    if (controller) {
      controller.abort()
      this.activeUploads.delete(itemId)
    }

    // Remove from queue
    this.queue = this.queue.filter((item) => item.id !== itemId)
    await this.saveToIndexedDB()
  }

  async cancelUpload(itemId: string) {
    const item = this.queue.find((i) => i.id === itemId)
    if (!item) return

    // Cancel if actively uploading
    const controller = this.activeUploads.get(itemId)
    if (controller) {
      controller.abort()
      this.activeUploads.delete(itemId)
    }

    // Mark as cancelled (remove from queue)
    this.queue = this.queue.filter((item) => item.id !== itemId)
    await this.saveToIndexedDB()
  }

  async cancelAllUploads() {
    // Cancel all active uploads
    for (const [itemId, controller] of this.activeUploads.entries()) {
      controller.abort()
    }
    this.activeUploads.clear()

    // Remove all pending, uploading, and processing items
    this.queue = this.queue.filter(
      (item) =>
        item.status !== 'pending' &&
        item.status !== 'uploading' &&
        item.status !== 'processing'
    )
    await this.saveToIndexedDB()
  }

  async clearCompleted() {
    this.queue = this.queue.filter(
      (item) => item.status !== 'completed' && item.status !== 'duplicate'
    )
    await this.saveToIndexedDB()
  }

  getQueue(): UploadQueueItem[] {
    return [...this.queue]
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    try {
      while (true) {
        // Get pending items
        const pendingItems = this.queue.filter((i) => i.status === 'pending')
        if (pendingItems.length === 0) break

        // Calculate available slots
        const availableSlots = this.maxConcurrent - this.activeUploads.size
        if (availableSlots <= 0) break

        // Process up to availableSlots items in parallel
        const itemsToProcess = pendingItems.slice(0, availableSlots)

        await Promise.allSettled(itemsToProcess.map((item) => this.uploadFile(item)))

        // Check if more items to process
        if (!this.queue.some((i) => i.status === 'pending')) break
      }
    } finally {
      this.processing = false
    }
  }

  private async uploadFile(item: UploadQueueItem) {
    const abortController = new AbortController()
    this.activeUploads.set(item.id, abortController)

    try {
      // Verify file is still accessible before uploading
      try {
        await item.file.arrayBuffer()
        // Reset the file by creating a new File object (arrayBuffer consumes the blob)
        // This is fine because we'll read it again in performUpload
      } catch (fileError) {
        // File no longer accessible - auto-cancel
        console.warn(`File no longer accessible: ${item.fileName}`, fileError)
        this.queue = this.queue.filter((i) => i.id !== item.id)
        await this.saveToIndexedDB()
        return
      }

      item.status = 'uploading'
      this.callbacks.onStatusChange(item.id, 'uploading')
      await this.saveToIndexedDB()

      await this.performUpload(item, abortController)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Upload was cancelled
        return
      }
      await this.handleError(item.id, error)
    } finally {
      this.activeUploads.delete(item.id)
      await this.saveToIndexedDB()

      // Continue processing queue
      this.processQueue()
    }
  }

  private performUpload(
    item: UploadQueueItem,
    controller: AbortController
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()

      // Verify file access one more time before FormData append
      try {
        formData.append('file', item.file)
        if (item.folderId) formData.append('folderId', item.folderId)
      } catch (fileError) {
        // File access error during FormData creation
        reject({
          code: 'FILE_ACCESS_ERROR',
          message: 'File is no longer accessible',
        })
        return
      }

      // Track upload progress (0-40%)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 40)
          this.callbacks.onProgress(item.id, progress, 'Uploading...')
        }
      }

      xhr.onload = async () => {
        try {
          const result = JSON.parse(xhr.responseText)

          if (xhr.status === 200 && result.success) {
            // Check if duplicate
            if (result.duplicate) {
              item.status = 'duplicate'
              item.progress = 100
              item.uploadedAt = new Date()
              this.callbacks.onStatusChange(item.id, 'duplicate')
              this.callbacks.onProgress(item.id, 100, 'Duplicate detected')
              resolve()
              return
            }

            // Update to processing stage
            item.status = 'processing'
            this.callbacks.onStatusChange(item.id, 'processing')

            // Simulate processing stages
            await this.simulateProcessing(item.id)

            // Mark as completed
            item.status = 'completed'
            item.progress = 100
            item.assetId = result.asset.id
            item.assetUrl = result.asset.url
            item.uploadedAt = new Date()

            this.callbacks.onComplete(item.id, result.asset)
            this.callbacks.onStatusChange(item.id, 'completed')
            resolve()
          } else {
            // API returned error
            const errorCode = result.code || 'SERVER_ERROR'
            const errorMessage = result.error || 'Upload failed'
            reject({ code: errorCode, message: errorMessage })
          }
        } catch (error) {
          reject({ code: 'PARSE_ERROR', message: 'Failed to parse server response' })
        }
      }

      xhr.onerror = () => {
        reject({ code: 'NETWORK_ERROR', message: 'Network error occurred' })
      }

      xhr.ontimeout = () => {
        reject({ code: 'TIMEOUT_ERROR', message: 'Upload timed out' })
      }

      // Handle abort
      controller.signal.addEventListener('abort', () => {
        xhr.abort()
      })

      xhr.open('POST', '/api/assets/upload-single')
      xhr.timeout = 60000 // 60 second timeout
      xhr.send(formData)
    })
  }

  private async simulateProcessing(itemId: string): Promise<void> {
    // Simulate 40-70% (processing stage)
    await new Promise((resolve) => setTimeout(resolve, 200))
    this.callbacks.onProgress(itemId, 60, 'Processing...')

    // Simulate 70-90% (face detection)
    await new Promise((resolve) => setTimeout(resolve, 400))
    this.callbacks.onProgress(itemId, 80, 'Detecting faces...')

    // Simulate 90-100% (finalizing)
    await new Promise((resolve) => setTimeout(resolve, 400))
    this.callbacks.onProgress(itemId, 95, 'Finalizing...')
  }

  private async handleError(itemId: string, error: any) {
    const item = this.queue.find((i) => i.id === itemId)
    if (!item) return

    const errorCode = error.code || 'UNKNOWN_ERROR'
    const errorMessage = error.message || 'An error occurred during upload'

    // Auto-cancel for non-retryable file access errors
    const autoRemoveErrors = ['FILE_ACCESS_ERROR']
    if (autoRemoveErrors.includes(errorCode)) {
      console.log(`Auto-removing upload due to file access error: ${item.fileName}`)
      this.queue = this.queue.filter((i) => i.id !== itemId)
      await this.saveToIndexedDB()
      return
    }

    // Check if retryable
    const retryableErrors = ['NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT_ERROR']
    const isRetryable = retryableErrors.includes(errorCode)
    const maxRetries = 3

    if (isRetryable && (item.retryCount || 0) < maxRetries) {
      // Auto-retry with exponential backoff
      const retryDelay = Math.pow(2, item.retryCount || 0) * 2000 // 2s, 4s, 8s
      setTimeout(() => {
        this.retryUpload(itemId)
      }, retryDelay)

      item.error = `${errorMessage} (retrying in ${retryDelay / 1000}s...)`
    } else {
      // Mark as failed
      item.status = 'failed'
      item.error = errorMessage
      item.progress = 0

      this.callbacks.onError(itemId, errorMessage, errorCode)
      this.callbacks.onStatusChange(itemId, 'failed')
    }

    await this.saveToIndexedDB()
  }

  private async saveToIndexedDB() {
    try {
      await uploadQueueDB.saveQueue(this.queue)
    } catch (error) {
      console.error('Failed to save upload queue to IndexedDB:', error)
    }
  }

  async cleanup() {
    // Cancel all active uploads
    for (const controller of this.activeUploads.values()) {
      controller.abort()
    }
    this.activeUploads.clear()

    // Clear old completed items
    await uploadQueueDB.clearOldCompletedItems()
  }
}
