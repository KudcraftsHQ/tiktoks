/**
 * Profile Monitor Worker
 *
 * Background worker that processes profile monitoring jobs
 */

import { Worker, Job } from 'bullmq'
import { PrismaClient } from '@/generated/prisma'
import { scrapeProfileVideos } from '../tiktok-scraping'
import {
  QUEUE_NAMES,
  defaultWorkerOptions,
  ProfileMonitorJobData,
  ProfileMonitorJobResult
} from './config'

class ProfileMonitorWorker {
  private worker: Worker<ProfileMonitorJobData, ProfileMonitorJobResult>
  private prisma: PrismaClient

  constructor() {
    console.log('🏗️ [ProfileMonitorWorker] Initializing worker...')
    console.log('📝 [ProfileMonitorWorker] Queue name:', QUEUE_NAMES.PROFILE_MONITOR)
    console.log('⚙️ [ProfileMonitorWorker] Worker options:', {
      concurrency: defaultWorkerOptions.concurrency,
      redis: process.env.REDIS_URL || 'localhost:6379'
    })

    this.prisma = new PrismaClient()
    this.worker = new Worker(
      QUEUE_NAMES.PROFILE_MONITOR,
      this.processJob.bind(this),
      defaultWorkerOptions
    )

    console.log('✅ [ProfileMonitorWorker] Worker instance created')

    // Debug: Check Redis connection
    if (defaultWorkerOptions.connection) {
      const conn = defaultWorkerOptions.connection as any
      console.log('🔍 [ProfileMonitorWorker] Redis connection state:', conn.status)
      conn.on('connect', () => console.log('✅ [ProfileMonitorWorker] Redis connected'))
      conn.on('ready', () => console.log('✅ [ProfileMonitorWorker] Redis ready'))
      conn.on('error', (err: Error) => console.error('❌ [ProfileMonitorWorker] Redis error:', err.message))
      conn.on('close', () => console.log('🔌 [ProfileMonitorWorker] Redis connection closed'))
    }

    // Set up event listeners
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.worker.on('ready', () => {
      console.log('🚀 [ProfileMonitorWorker] Worker is ready and waiting for jobs')
    })

    this.worker.on('active', (job) => {
      console.log(`🔄 [ProfileMonitorWorker] Processing job ${job.id}: ${job.data.profileId}`)
      console.log(`📊 [ProfileMonitorWorker] Job details:`, {
        id: job.id,
        name: job.name,
        data: job.data,
        priority: job.opts.priority,
        attempts: job.attemptsMade,
        timestamp: new Date().toISOString()
      })
    })

    this.worker.on('completed', (job, result) => {
      console.log(`✅ [ProfileMonitorWorker] Job ${job.id} completed:`, result)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`❌ [ProfileMonitorWorker] Job ${job?.id} failed:`, err)
    })

    this.worker.on('error', (err) => {
      console.error('❌ [ProfileMonitorWorker] Worker error:', err)
    })

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️ [ProfileMonitorWorker] Job ${jobId} stalled`)
    })

    this.worker.on('drained', () => {
      console.log('💤 [ProfileMonitorWorker] Queue drained, waiting for new jobs...')
    })

    console.log('🎧 [ProfileMonitorWorker] Event listeners registered')
  }

  private async processJob(
    job: Job<ProfileMonitorJobData>
  ): Promise<ProfileMonitorJobResult> {
    const { profileId } = job.data

    console.log(`🚀 [ProfileMonitorWorker] Starting monitoring job for profile:`, {
      profileId
    })

    // Create monitoring log entry
    const monitoringLog = await this.prisma.profileMonitoringLog.create({
      data: {
        profileId,
        status: 'running',
        startedAt: new Date()
      }
    })

    console.log(`📝 [ProfileMonitorWorker] Created monitoring log: ${monitoringLog.id}`)

    try {
      // Fetch profile to get handle
      const profile = await this.prisma.tiktokProfile.findUnique({
        where: { id: profileId }
      })

      if (!profile) {
        throw new Error(`Profile not found: ${profileId}`)
      }

      console.log(`👤 [ProfileMonitorWorker] Monitoring profile: @${profile.handle}`)

      let totalPostsScraped = 0
      let pagesScraped = 0
      let maxCursor: string | undefined = undefined
      let hasMore = true

      // Loop through all pages
      while (hasMore) {
        console.log(`📄 [ProfileMonitorWorker] Fetching page ${pagesScraped + 1} for @${profile.handle}`)

        // Scrape profile videos
        const result = await scrapeProfileVideos(profile.handle, maxCursor, true)

        pagesScraped++
        console.log(`✅ [ProfileMonitorWorker] Page ${pagesScraped} fetched: ${result.posts.length} posts`)

        if (result.posts.length > 0) {
          // Before upserting, save current metrics to history
          await this.saveMetricsHistory(result.posts)

          // Prepare data for bulk upsert
          const profileData = {
            handle: profile.handle,
            nickname: result.profile?.nickname || profile.nickname,
            avatar: result.profile?.avatar || undefined,
            bio: result.profile?.bio || profile.bio,
            verified: result.profile?.verified ?? profile.verified,
            followerCount: profile.followerCount,
            followingCount: profile.followingCount,
            videoCount: profile.videoCount,
            likeCount: profile.likeCount
          }

          const postsForUpsert = result.posts.map(post => ({
            tiktokId: post.tiktokId,
            tiktokUrl: post.tiktokUrl,
            contentType: post.contentType,
            title: post.title,
            description: post.description,
            authorNickname: post.authorNickname,
            authorHandle: post.authorHandle,
            authorAvatar: post.authorAvatar,
            hashtags: post.hashtags,
            mentions: post.mentions,
            viewCount: post.viewCount,
            likeCount: post.likeCount,
            shareCount: post.shareCount,
            commentCount: post.commentCount,
            saveCount: post.saveCount,
            duration: post.duration,
            videoUrl: post.videoUrl,
            coverUrl: post.coverUrl,
            musicUrl: post.musicUrl,
            images: post.images,
            publishedAt: post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt
          }))

          // Call bulk upsert API (internal call)
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const upsertResponse = await fetch(`${baseUrl}/api/tiktok/posts/bulk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              profile: profileData,
              posts: postsForUpsert
            })
          })

          if (!upsertResponse.ok) {
            const errorText = await upsertResponse.text()
            throw new Error(`Bulk upsert failed: ${errorText}`)
          }

          const upsertResult = await upsertResponse.json()
          totalPostsScraped += upsertResult.stats.totalPosts
          console.log(`✅ [ProfileMonitorWorker] Upserted ${upsertResult.stats.totalPosts} posts from page ${pagesScraped}`)
        }

        // Check if there are more pages
        hasMore = result.hasMore
        maxCursor = result.maxCursor

        if (hasMore && maxCursor) {
          console.log(`➡️ [ProfileMonitorWorker] More pages available, continuing...`)
          // Small delay between pages to be respectful
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.log(`🏁 [ProfileMonitorWorker] All pages processed for @${profile.handle}`)
        }
      }

      // Update monitoring log with success
      await this.prisma.profileMonitoringLog.update({
        where: { id: monitoringLog.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          postsScraped: totalPostsScraped,
          pagesScraped
        }
      })

      // Update profile with last monitoring run and next scheduled run (24 hours from now)
      const nextRun = new Date()
      nextRun.setHours(nextRun.getHours() + 24)

      await this.prisma.tiktokProfile.update({
        where: { id: profileId },
        data: {
          lastMonitoringRun: new Date(),
          nextMonitoringRun: nextRun,
          updatedAt: new Date()
        }
      })

      console.log(`✅ [ProfileMonitorWorker] Successfully monitored profile @${profile.handle}:`, {
        postsScraped: totalPostsScraped,
        pagesScraped,
        nextRun: nextRun.toISOString()
      })

      return {
        success: true,
        profileId,
        postsScraped: totalPostsScraped,
        pagesScraped
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ [ProfileMonitorWorker] Failed to monitor profile ${profileId}:`, errorMessage)

      // Update monitoring log with failure
      await this.prisma.profileMonitoringLog.update({
        where: { id: monitoringLog.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage
        }
      })

      return {
        success: false,
        profileId,
        error: errorMessage
      }
    }
  }

  /**
   * Save current metrics to history before upserting new data
   */
  private async saveMetricsHistory(posts: any[]): Promise<void> {
    console.log(`💾 [ProfileMonitorWorker] Saving metrics history for ${posts.length} posts`)

    // Fetch existing posts by tiktokId
    const tiktokIds = posts.map(p => p.tiktokId)
    const existingPosts = await this.prisma.tiktokPost.findMany({
      where: {
        tiktokId: {
          in: tiktokIds
        }
      },
      select: {
        id: true,
        tiktokId: true,
        viewCount: true,
        likeCount: true,
        shareCount: true,
        commentCount: true,
        saveCount: true
      }
    })

    // Create a map for quick lookup
    const existingPostsMap = new Map(existingPosts.map(p => [p.tiktokId, p]))

    // Create history entries for existing posts
    const historyEntries = posts
      .filter(post => existingPostsMap.has(post.tiktokId))
      .map(post => {
        const existingPost = existingPostsMap.get(post.tiktokId)!
        return {
          postId: existingPost.id,
          viewCount: existingPost.viewCount,
          likeCount: existingPost.likeCount,
          shareCount: existingPost.shareCount,
          commentCount: existingPost.commentCount,
          saveCount: existingPost.saveCount,
          recordedAt: new Date()
        }
      })

    if (historyEntries.length > 0) {
      await this.prisma.tikTokPostMetricsHistory.createMany({
        data: historyEntries,
        skipDuplicates: true
      })
      console.log(`✅ [ProfileMonitorWorker] Saved ${historyEntries.length} metrics history entries`)
    } else {
      console.log(`ℹ️ [ProfileMonitorWorker] No existing posts found, skipping metrics history`)
    }
  }

  /**
   * Gracefully close the worker
   */
  async close(): Promise<void> {
    console.log('🛑 [ProfileMonitorWorker] Closing worker...')
    await this.worker.close()
    await this.prisma.$disconnect()
    console.log('✅ [ProfileMonitorWorker] Worker closed successfully')
  }

  /**
   * Get worker instance for monitoring
   */
  getWorker(): Worker<ProfileMonitorJobData, ProfileMonitorJobResult> {
    return this.worker
  }
}

// Export singleton instance
export const profileMonitorWorker = new ProfileMonitorWorker()
export default ProfileMonitorWorker
