import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { parseTikTokUrl } from '@/lib/tiktok-url-parser'

const prisma = new PrismaClient()

export async function PATCH(
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
    const { postedUrl, postedAt } = body

    // Validate posted URL if provided
    if (postedUrl && typeof postedUrl !== 'string') {
      return NextResponse.json(
        { error: 'postedUrl must be a string' },
        { status: 400 }
      )
    }

    // If URL is provided, validate it's a TikTok URL
    if (postedUrl) {
      const parsedUrl = parseTikTokUrl(postedUrl)
      if (!parsedUrl.isValid) {
        return NextResponse.json(
          { error: 'Invalid TikTok URL format' },
          { status: 400 }
        )
      }
    }

    // Check if remix exists
    const existingRemix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      select: { id: true }
    })

    if (!existingRemix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      postedUrl: postedUrl || null
    }

    // Set postedAt to provided value or current time if URL is set, null if URL is cleared
    if (postedUrl) {
      updateData.postedAt = postedAt ? new Date(postedAt) : new Date()
    } else {
      updateData.postedAt = null
    }

    // Update the remix
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: updateData,
      select: {
        id: true,
        postedUrl: true,
        postedAt: true
      }
    })

    console.log(`🔗 [API] Updated posted URL for remix ${remixId}: ${postedUrl || 'cleared'}`)

    // Try to find linked post if URL was set
    let linkedPost = null
    if (updatedRemix.postedUrl) {
      const parsedUrl = parseTikTokUrl(updatedRemix.postedUrl)

      // Try to find matching post
      const whereClause: any = {
        OR: [
          { tiktokUrl: parsedUrl.normalizedUrl },
          { tiktokUrl: updatedRemix.postedUrl }
        ]
      }

      if (parsedUrl.videoId) {
        whereClause.OR.push({ tiktokId: parsedUrl.videoId })
      }

      const foundPost = await prisma.tiktokPost.findFirst({
        where: whereClause,
        include: {
          profile: {
            select: {
              id: true,
              handle: true,
              nickname: true,
              isOwnProfile: true
            }
          }
        }
      })

      if (foundPost) {
        linkedPost = {
          id: foundPost.id,
          tiktokUrl: foundPost.tiktokUrl,
          viewCount: foundPost.viewCount?.toString() || '0',
          likeCount: foundPost.likeCount || 0,
          shareCount: foundPost.shareCount || 0,
          commentCount: foundPost.commentCount || 0,
          saveCount: foundPost.saveCount || 0,
          publishedAt: foundPost.publishedAt,
          profile: foundPost.profile
        }

        console.log(`📊 [API] Found linked post ${foundPost.id} for remix ${remixId}`)
      }
    }

    return NextResponse.json({
      success: true,
      postedUrl: updatedRemix.postedUrl,
      postedAt: updatedRemix.postedAt,
      linkedPost
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to update posted URL for remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update posted URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
