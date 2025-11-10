import { PrismaClient, Prisma } from '@/generated/prisma/client'
import { cacheAssetService } from './cache-asset-service'

const prisma = new PrismaClient()

export interface CreateDraftSessionInput {
  name?: string
  generationStrategy: string
  languageStyle: string
  contentIdeas?: string
  slidesRange: { min: number; max: number }
  productContextId?: string
  sourcePostIds: string[]
}

export interface DraftSessionWithData {
  id: string
  name: string
  generationStrategy: string
  languageStyle: string
  contentIdeas: string | null
  slidesRange: { min: number; max: number }
  productContextId: string | null
  createdAt: Date
  updatedAt: Date
  drafts: any[]
  referencePosts: any[]
}

class DraftSessionService {
  /**
   * Create a new draft session
   */
  async createDraftSession(input: CreateDraftSessionInput) {
    const { sourcePostIds, ...sessionData } = input

    // Generate default name if not provided
    const defaultName = `Draft Session - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`

    const session = await prisma.draftSession.create({
      data: {
        name: input.name || defaultName,
        generationStrategy: sessionData.generationStrategy,
        languageStyle: sessionData.languageStyle,
        contentIdeas: sessionData.contentIdeas,
        slidesRange: sessionData.slidesRange as Prisma.InputJsonValue,
        productContextId: sessionData.productContextId,
      },
    })

    return session
  }

  /**
   * Get draft session with all drafts and reference posts
   */
  async getDraftSessionWithData(sessionId: string): Promise<DraftSessionWithData | null> {
    const session = await prisma.draftSession.findUnique({
      where: { id: sessionId },
      include: {
        drafts: {
          orderBy: { createdAt: 'asc' },
        },
        productContext: true,
      },
    })

    if (!session) {
      return null
    }

    // Get source post IDs from first draft (all drafts in session share same sources)
    const firstDraft = session.drafts[0]
    const sourcePostIds = firstDraft?.sourcePostIds || []

    // Fetch reference posts
    let referencePosts: any[] = []
    if (sourcePostIds.length > 0) {
      const posts = await prisma.tiktokPost.findMany({
        where: { id: { in: sourcePostIds } },
        orderBy: { publishedAt: 'desc' },
      })

      // Resolve asset URLs for reference posts
      referencePosts = await Promise.all(
        posts.map(async (post) => {
          const images = Array.isArray(post.images) ? post.images : []

          // Resolve image URLs
          const imagePromises = images.map(async (img: any) => {
            if (img.cacheAssetId) {
              const url = await cacheAssetService.getUrl(img.cacheAssetId)
              return { ...img, url }
            }
            return img
          })

          const resolvedImages = await Promise.all(imagePromises)

          // Resolve other asset URLs
          const [videoUrl, coverUrl, musicUrl, avatarUrl] = await Promise.all([
            post.videoId ? cacheAssetService.getUrl(post.videoId) : null,
            post.coverId ? cacheAssetService.getUrl(post.coverId) : null,
            post.musicId ? cacheAssetService.getUrl(post.musicId) : null,
            post.authorAvatarId ? cacheAssetService.getUrl(post.authorAvatarId) : null,
          ])

          // Parse JSON fields if they're strings (Prisma should handle this, but double-check)
          const parseJsonField = (field: any) => {
            if (typeof field === 'string') {
              try {
                return JSON.parse(field)
              } catch {
                return field
              }
            }
            return field
          }

          return {
            ...post,
            // Convert BigInt to number for JSON serialization
            viewCount: post.viewCount ? Number(post.viewCount) : 0,
            images: resolvedImages,
            videoUrl,
            coverUrl,
            musicUrl,
            authorAvatarUrl: avatarUrl,
            // Ensure JSON fields are parsed
            ocrTexts: parseJsonField(post.ocrTexts),
            slideClassifications: parseJsonField(post.slideClassifications),
            imageDescriptions: parseJsonField(post.imageDescriptions),
          }
        })
      )
    }

    return {
      id: session.id,
      name: session.name,
      generationStrategy: session.generationStrategy,
      languageStyle: session.languageStyle,
      contentIdeas: session.contentIdeas,
      slidesRange: session.slidesRange as { min: number; max: number },
      productContextId: session.productContextId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      drafts: session.drafts,
      referencePosts,
    }
  }

  /**
   * Update draft session name
   */
  async updateSessionName(sessionId: string, name: string) {
    const session = await prisma.draftSession.update({
      where: { id: sessionId },
      data: { name },
    })

    return session
  }

  /**
   * Delete draft session and all associated drafts
   */
  async deleteDraftSession(sessionId: string) {
    // Delete all drafts in the session (will cascade delete text styles and classifications)
    await prisma.remixPost.deleteMany({
      where: { sessionId },
    })

    // Delete the session itself
    await prisma.draftSession.delete({
      where: { id: sessionId },
    })

    return { success: true }
  }

  /**
   * Get session generation config for adding more variations
   */
  async getSessionConfig(sessionId: string) {
    const session = await prisma.draftSession.findUnique({
      where: { id: sessionId },
      include: {
        drafts: {
          take: 1, // Just need one to get sourcePostIds
        },
      },
    })

    if (!session) {
      return null
    }

    const firstDraft = session.drafts[0]
    const sourcePostIds = firstDraft?.sourcePostIds || []

    return {
      sessionId: session.id,
      generationStrategy: session.generationStrategy,
      languageStyle: session.languageStyle,
      contentIdeas: session.contentIdeas,
      slidesRange: session.slidesRange as { min: number; max: number },
      productContextId: session.productContextId,
      sourcePostIds,
    }
  }

  /**
   * List all draft sessions with summary data
   */
  async listDraftSessions(page = 1, limit = 25) {
    const skip = (page - 1) * limit

    const [sessions, total] = await Promise.all([
      prisma.draftSession.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          drafts: {
            select: { id: true },
          },
          productContext: {
            select: { id: true, title: true },
          },
        },
      }),
      prisma.draftSession.count(),
    ])

    const sessionsWithCounts = sessions.map((session) => ({
      ...session,
      draftCount: session.drafts.length,
      drafts: undefined, // Remove full drafts array
    }))

    return {
      sessions: sessionsWithCounts,
      total,
      page,
      limit,
      hasMore: skip + sessions.length < total,
    }
  }
}

export const draftSessionService = new DraftSessionService()
