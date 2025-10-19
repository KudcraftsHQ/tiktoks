import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { parseTikTokUrl } from '@/lib/tiktok-url-parser'

const prisma = new PrismaClient()

const LinkOriginalPostSchema = z.object({
  tiktokUrl: z.string().url('Must be a valid URL')
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const remixId = resolvedParams.id

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = LinkOriginalPostSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { tiktokUrl } = validation.data

    console.log(`🔗 [API] Linking original post to remix ${remixId}: ${tiktokUrl}`)

    // Parse the TikTok URL
    const parsedUrl = parseTikTokUrl(tiktokUrl)

    // Try to find the TikTok post in the database
    const whereClause: any = {
      OR: [
        { tiktokUrl: parsedUrl.normalizedUrl },
        { tiktokUrl: tiktokUrl }
      ]
    }

    if (parsedUrl.videoId) {
      whereClause.OR.push({ tiktokId: parsedUrl.videoId })
    }

    const tiktokPost = await prisma.tiktokPost.findFirst({
      where: whereClause
    })

    if (!tiktokPost) {
      return NextResponse.json(
        {
          error: 'TikTok post not found in database',
          message: 'Please fetch/scrape this TikTok post first before linking it'
        },
        { status: 404 }
      )
    }

    // Update the remix to link to the original post
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        originalPostId: tiktokPost.id
      },
      include: {
        originalPost: {
          include: {
            profile: true
          }
        }
      }
    })

    console.log(`✅ [API] Successfully linked original post to remix: ${remixId}`)

    // Return with BigInt conversion
    return NextResponse.json({
      success: true,
      message: 'Original post linked successfully',
      remix: {
        ...updatedRemix,
        originalPost: updatedRemix.originalPost ? {
          ...updatedRemix.originalPost,
          viewCount: updatedRemix.originalPost.viewCount?.toString() || '0',
          profile: {
            ...updatedRemix.originalPost.profile,
            totalViews: updatedRemix.originalPost.profile.totalViews?.toString() || '0',
            totalLikes: updatedRemix.originalPost.profile.totalLikes?.toString() || '0',
            totalShares: updatedRemix.originalPost.profile.totalShares?.toString() || '0',
            totalComments: updatedRemix.originalPost.profile.totalComments?.toString() || '0',
            totalSaves: updatedRemix.originalPost.profile.totalSaves?.toString() || '0'
          }
        } : null
      }
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to link original post to remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to link original post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
