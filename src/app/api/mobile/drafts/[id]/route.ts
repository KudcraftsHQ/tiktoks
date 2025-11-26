import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { RemixSlideSchema, CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema';
import { cacheAssetService } from '@/lib/cache-asset-service';

const prisma = new PrismaClient();

// Utility function to normalize and bootstrap slide data
function normalizeSlides(rawSlides: any): any[] {
  try {
    // Parse slides if they come as JSON string
    const slidesArray = typeof rawSlides === 'string' ? JSON.parse(rawSlides) : rawSlides;

    // If slides array is empty, return empty array (handled by frontend)
    if (!Array.isArray(slidesArray) || slidesArray.length === 0) {
      return [];
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
          ...slide,
        };

        // Validate and normalize using Zod schema (this applies all schema defaults)
        return RemixSlideSchema.parse(baseSlide);
      } catch (validationError) {
        console.warn(`Failed to validate slide ${index}, using default:`, validationError);
        // Return a minimal valid slide as fallback
        return RemixSlideSchema.parse({
          id: `slide_${Date.now()}_${index}`,
          displayOrder: index,
          canvas: CANVAS_SIZES.INSTAGRAM_STORY,
          backgroundLayers: createDefaultBackgroundLayers(),
          originalImageIndex: index,
          paraphrasedText: 'Default slide content',
          textBoxes: [],
        });
      }
    });
  } catch (parseError) {
    console.warn('Failed to parse slides JSON, returning empty array:', parseError);
    return [];
  }
}

/**
 * GET /api/mobile/drafts/[id]
 * Fetch a single draft/remix for mobile sharing
 * Read-only endpoint for mobile interface
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const remixId = resolvedParams.id;

    if (!remixId) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      );
    }

    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        originalPost: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!remix) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Check if the draft is bookmarked
    if (!remix.bookmarked) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Normalize slides data with proper bootstrapping and defaults
    const normalizedSlides = normalizeSlides(remix.slides);

    // If no original post, return simplified response
    if (!remix.originalPost) {
      return NextResponse.json({
        ...remix,
        slides: normalizedSlides,
        originalPost: null,
      });
    }

    // Parse images JSON and generate presigned URLs for each image
    let images = [];
    try {
      const imageString =
        typeof remix.originalPost.images === 'string'
          ? remix.originalPost.images
          : JSON.stringify(remix.originalPost.images || '[]');
      const parsedImages = JSON.parse(imageString);
      if (parsedImages.length > 0) {
        const imageIds = parsedImages.map((img: any) => img.cacheAssetId);
        const presignedImageUrls = await cacheAssetService.getUrls(imageIds);

        images = parsedImages.map((img: any, imgIndex: number) => ({
          ...img,
          url: presignedImageUrls[imgIndex],
        }));
      } else {
        images = parsedImages;
      }
    } catch (error) {
      console.warn('Failed to parse images for remix post:', remix.id, error);
      const fallbackImageString =
        typeof remix.originalPost.images === 'string'
          ? remix.originalPost.images
          : JSON.stringify(remix.originalPost.images || '[]');
      try {
        images = JSON.parse(fallbackImageString);
      } catch (fallbackError) {
        console.warn('Failed to parse fallback images, using empty array:', fallbackError);
        images = [];
      }
    }

    // Generate presigned URLs for other media assets
    const [coverUrl, authorAvatarUrl] = await Promise.all([
      cacheAssetService.getUrl(remix.originalPost.coverId),
      cacheAssetService.getUrl(remix.originalPost.authorAvatarId),
    ]);

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
            : null,
        },
      },
    };

    return NextResponse.json(responseRemix);
  } catch (error) {
    const resolvedParams = await params;
    console.error(`❌ [Mobile API] Failed to get draft ${resolvedParams.id}:`, error);

    return NextResponse.json(
      {
        error: 'Failed to get draft',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
