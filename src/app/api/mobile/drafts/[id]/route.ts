import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { RemixSlideSchema, CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema';
import { cacheAssetService } from '@/lib/cache-asset-service';
import { z } from 'zod';

// Mobile text overlay schema (simplified version for mobile editor)
const MobileTextOverlaySchema = z.object({
  id: z.string(),
  text: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  fontSize: z.number().min(20).max(120),
  alignment: z.enum(['left', 'center', 'right']),
  style: z.enum(['pill', 'outline']),
  maxWidth: z.number().min(0.5).max(0.95),
});

// Schema for updating mobile overlays
const UpdateMobileOverlaysSchema = z.object({
  slides: z.array(z.object({
    slideId: z.string(),
    imageOffsetY: z.number().min(0).max(1).optional(),
    textOverlays: z.array(MobileTextOverlaySchema),
  })),
});

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

/**
 * PATCH /api/mobile/drafts/[id]
 * Update mobile text overlays for a draft
 * Converts mobile overlay format to textBoxes format and saves to DB
 */
export async function PATCH(
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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateMobileOverlaysSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { slides: slideUpdates } = validationResult.data;

    // Fetch existing remix
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
    });

    if (!remix) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Parse existing slides
    const existingSlides = typeof remix.slides === 'string'
      ? JSON.parse(remix.slides)
      : remix.slides;

    if (!Array.isArray(existingSlides)) {
      return NextResponse.json(
        { error: 'Invalid slides data' },
        { status: 500 }
      );
    }

    // Update slides with new text overlays
    const updatedSlides = existingSlides.map((slide: any) => {
      const update = slideUpdates.find(u => u.slideId === slide.id);

      if (!update) {
        return slide;
      }

      // Convert mobile text overlays to textBoxes format
      // Store mobile-specific data in a way that can be reconstructed
      const textBoxes = update.textOverlays.map((overlay) => ({
        id: overlay.id,
        text: overlay.text,
        x: overlay.x,
        y: overlay.y,
        width: overlay.maxWidth, // Store maxWidth as width
        height: 0.5, // Default height (not used in mobile)
        fontSize: overlay.fontSize,
        fontFamily: 'Poppins',
        fontWeight: '600' as const,
        color: overlay.style === 'pill' ? '#000000' : '#ffffff',
        textAlign: overlay.alignment,
        // Store mobile-specific properties in custom fields
        // Using backgroundColor to indicate pill style
        backgroundColor: overlay.style === 'pill' ? '#ffffff' : '#00000000',
        backgroundOpacity: overlay.style === 'pill' ? 1 : 0,
        // Store outline properties
        outlineWidth: overlay.style === 'outline' ? 2 : 0,
        outlineColor: '#000000',
        // Store maxWidth in a recoverable way (using letterSpacing as proxy)
        // Actually, let's use a cleaner approach - store raw mobile data
        _mobileStyle: overlay.style,
        _mobileMaxWidth: overlay.maxWidth,
      }));

      return {
        ...slide,
        textBoxes,
        // Store image offset if provided
        ...(update.imageOffsetY !== undefined && {
          _mobileImageOffsetY: update.imageOffsetY
        }),
      };
    });

    // Save to database
    await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slides: JSON.stringify(updatedSlides),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`❌ [Mobile API] Failed to update draft ${resolvedParams.id}:`, error);

    return NextResponse.json(
      {
        error: 'Failed to update draft',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
