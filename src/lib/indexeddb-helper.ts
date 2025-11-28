import Dexie, { type Table } from 'dexie'

export interface UploadQueueItem {
  id: string
  file: File
  fileName: string
  folderId?: string | null
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'duplicate'
  progress: number
  processingStage?: string
  error?: string
  assetId?: string
  assetUrl?: string
  retryCount?: number
  uploadedAt?: Date
}

class UploadQueueDB extends Dexie {
  uploadQueue!: Table<UploadQueueItem, string>

  constructor() {
    super('carousel-uploads')

    this.version(1).stores({
      uploadQueue: 'id, status, uploadedAt',
    })
  }

  async saveQueue(items: UploadQueueItem[]) {
    await this.uploadQueue.clear()
    await this.uploadQueue.bulkPut(items)
  }

  async loadQueue(): Promise<UploadQueueItem[]> {
    return await this.uploadQueue.toArray()
  }

  async updateItem(id: string, changes: Partial<UploadQueueItem>) {
    await this.uploadQueue.update(id, changes)
  }

  async clearOldCompletedItems() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    await this.uploadQueue
      .where('status')
      .anyOf(['completed', 'duplicate'])
      .and((item) => {
        if (!item.uploadedAt) return false
        return new Date(item.uploadedAt).getTime() < oneDayAgo
      })
      .delete()
  }
}

export const uploadQueueDB = new UploadQueueDB()
