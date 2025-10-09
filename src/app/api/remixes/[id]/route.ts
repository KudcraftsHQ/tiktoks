import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { UpdateRemixSchema, RemixPostType, RemixSlideSchema, CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

// Utility function to normalize and bootstrap slide data
function normalizeSlides(rawSlides: any): RemixPostType['slides'] {
  try {
    // Parse slides if they come as JSON string
    const slidesArray = typeof rawSlides === 'string' ? JSON.parse(rawSlides) : rawSlides

    // If slides array is empty, return empty array (handled by frontend)
    if (!Array.isArray(slidesArray) || slidesArray.length === 0) {
      return []
    }

    // Normalize each slide using the schema defaults
    return slidesArray.map((slide: any, index: number) => {
      try {
        // Create a base slide with required defaults
        const baseSlide = {
          id: slide.id || `slide_${Date.now()}_${index}`,
          displayOrder: slide.displayOrder ?? index,
          canvas: slide.canvas || CANVAS_SIZES.INSTAGRAM_STORY,
          backgroundLayers: slide.backgroundLayers || createDefaultBackgroundLayers(),
          originalImageIndex: slide.originalImageIndex ?? index,
          paraphrasedText: slide.paraphrasedText || '',
          originalText: slide.originalText || '',
          textBoxes: slide.textBoxes || [],
          // Include any additional fields that might exist
          ...slide
        }

        // Validate and normalize using Zod schema (this applies all schema defaults)
        return RemixSlideSchema.parse(baseSlide)
      } catch (validationError) {
        console.warn(`Failed to validate slide ${index}, using default:`, validationError)
        // Return a minimal valid slide as fallback
        return RemixSlideSchema.parse({
          id: `slide_${Date.now()}_${index}`,
          displayOrder: index,
          canvas: CANVAS_SIZES.INSTAGRAM_STORY,
          backgroundLayers: createDefaultBackgroundLayers(),
          originalImageIndex: index,
          paraphrasedText: 'Default slide content',
          textBoxes: []
        })
      }
    })
  } catch (parseError) {
    console.warn('Failed to parse slides JSON, returning empty array:', parseError)
    return []
  }
}

export async function GET(
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

    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        originalPost: {
          include: {
            profile: true
          }
        }
      }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Parse images JSON and generate presigned URLs for each image
    let images = []
    try {
      const imageString = typeof remix.originalPost.images === 'string'
        ? remix.originalPost.images
        : JSON.stringify(remix.originalPost.images || '[]')
      const parsedImages = JSON.parse(imageString)
      if (parsedImages.length > 0) {
        const imageIds = parsedImages.map((img: any) => img.cacheAssetId)
        const presignedImageUrls = await cacheAssetService.getUrls(imageIds)

        images = parsedImages.map((img: any, imgIndex: number) => ({
          ...img,
          url: presignedImageUrls[imgIndex]
        }))
      } else {
        images = parsedImages
      }
    } catch (error) {
      console.warn('Failed to parse images for remix post:', remix.id, error)
      const fallbackImageString = typeof remix.originalPost.images === 'string'
        ? remix.originalPost.images
        : JSON.stringify(remix.originalPost.images || '[]')
      try {
        images = JSON.parse(fallbackImageString)
      } catch (fallbackError) {
        console.warn('Failed to parse fallback images, using empty array:', fallbackError)
        images = []
      }
    }

    // Generate presigned URLs for other media assets
    const [coverUrl, authorAvatarUrl] = await Promise.all([
      cacheAssetService.getUrl(remix.originalPost.coverId),
      cacheAssetService.getUrl(remix.originalPost.authorAvatarId)
    ])

    // Normalize slides data with proper bootstrapping and defaults
    const normalizedSlides = normalizeSlides(remix.slides)

    // Convert BigInt to string for JSON serialization and add presigned URLs
    const responseRemix = {
      ...remix,
      slides: normalizedSlides,
      originalPost: {
        ...remix.originalPost,
        viewCount: remix.originalPost.viewCount?.toString() || '0',
        images: images,
        coverUrl: coverUrl,
        authorAvatar: authorAvatarUrl,
        profile: {
          ...remix.originalPost.profile,
          totalViews: remix.originalPost.profile.totalViews?.toString() || '0',
          totalLikes: remix.originalPost.profile.totalLikes?.toString() || '0',
          totalShares: remix.originalPost.profile.totalShares?.toString() || '0',
          totalComments: remix.originalPost.profile.totalComments?.toString() || '0',
          totalSaves: remix.originalPost.profile.totalSaves?.toString() || '0',
          // Generate avatar URL for profile if needed
          avatarUrl: remix.originalPost.profile.avatarId
            ? await cacheAssetService.getUrl(remix.originalPost.profile.avatarId)
            : null
        }
      }
    }

    return NextResponse.json(responseRemix)

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to get remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

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
    const validation = UpdateRemixSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { name, description, slides } = validation.data

    console.log(`📝 [API] Updating remix: ${remixId}`)

    // Update the remix with the new data
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(slides !== undefined && { slides: JSON.stringify(slides) }),
        updatedAt: new Date()
      },
      include: {
        originalPost: {
          include: {
            profile: true
          }
        }
      }
    })

    // Parse images JSON and generate presigned URLs for each image
    let images = []
    try {
      const imageString = typeof updatedRemix.originalPost.images === 'string'
        ? updatedRemix.originalPost.images
        : JSON.stringify(updatedRemix.originalPost.images || '[]')
      const parsedImages = JSON.parse(imageString)
      if (parsedImages.length > 0) {
        const imageIds = parsedImages.map((img: any) => img.cacheAssetId)
        const presignedImageUrls = await cacheAssetService.getUrls(imageIds)

        images = parsedImages.map((img: any, imgIndex: number) => ({
          ...img,
          url: presignedImageUrls[imgIndex]
        }))
      } else {
        images = parsedImages
      }
    } catch (error) {
      console.warn('Failed to parse images for updated remix post:', updatedRemix.id, error)
      const fallbackImageString = typeof updatedRemix.originalPost.images === 'string'
        ? updatedRemix.originalPost.images
        : JSON.stringify(updatedRemix.originalPost.images || '[]')
      try {
        images = JSON.parse(fallbackImageString)
      } catch (fallbackError) {
        console.warn('Failed to parse fallback images, using empty array:', fallbackError)
        images = []
      }
    }

    // Generate presigned URLs for other media assets
    const [coverUrl, authorAvatarUrl] = await Promise.all([
      cacheAssetService.getUrl(updatedRemix.originalPost.coverId),
      cacheAssetService.getUrl(updatedRemix.originalPost.authorAvatarId)
    ])

    // Normalize slides data with proper bootstrapping and defaults
    const normalizedSlides = normalizeSlides(updatedRemix.slides)

    // Convert BigInt to string for JSON serialization and add presigned URLs
    const responseRemix = {
      ...updatedRemix,
      slides: normalizedSlides,
      originalPost: {
        ...updatedRemix.originalPost,
        viewCount: updatedRemix.originalPost.viewCount?.toString() || '0',
        images: images,
        coverUrl: coverUrl,
        authorAvatar: authorAvatarUrl,
        profile: {
          ...updatedRemix.originalPost.profile,
          totalViews: updatedRemix.originalPost.profile.totalViews?.toString() || '0',
          totalLikes: updatedRemix.originalPost.profile.totalLikes?.toString() || '0',
          totalShares: updatedRemix.originalPost.profile.totalShares?.toString() || '0',
          totalComments: updatedRemix.originalPost.profile.totalComments?.toString() || '0',
          totalSaves: updatedRemix.originalPost.profile.totalSaves?.toString() || '0',
          // Generate avatar URL for profile if needed
          avatarUrl: updatedRemix.originalPost.profile.avatarId
            ? await cacheAssetService.getUrl(updatedRemix.originalPost.profile.avatarId)
            : null
        }
      }
    }

    console.log(`✅ [API] Successfully updated remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Remix updated successfully',
      remix: responseRemix
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to update remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Delete the remix (cascade will handle slides and text boxes)
    await prisma.remixPost.delete({
      where: { id: remixId }
    })

    console.log(`🗑️ [API] Successfully deleted remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Remix deleted successfully'
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to delete remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to delete remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}