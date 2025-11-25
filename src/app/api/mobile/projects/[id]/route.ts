import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// Helper function to convert BigInt and Date values for JSON serialization
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeBigInt(obj[key]);
      }
    }
    return serialized;
  }

  return obj;
}

/**
 * GET /api/mobile/projects/[id]
 * Fetch a single project with its drafts for mobile interface
 * Read-only endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        posts: {
          include: {
            post: true,
          },
          orderBy: {
            addedAt: 'desc',
          },
        },
        remixes: {
          where: {
            isDraft: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            generationType: true,
            bookmarked: true,
            approved: true,
            createdAt: true,
            updatedAt: true,
            slides: true,
            slideClassifications: true, // JSON field, not a relation
            productContext: {
              select: {
                id: true,
                title: true,
                description: true,
              },
            },
          },
          orderBy: [
            { createdAt: 'asc' }, // Oldest first for consistent ordering
            { id: 'asc' }, // Secondary sort by id for stability
          ],
        },
        _count: {
          select: {
            posts: true,
            remixes: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse JSON fields in posts
    const processedProject = {
      ...project,
      posts: project.posts.map(({ post, ...projectPost }) => ({
        ...projectPost,
        post: {
          ...post,
          // Parse images JSON if it's a string
          images: typeof post.images === 'string' ? JSON.parse(post.images) : post.images,
          // Parse hashtags JSON if it's a string
          hashtags: typeof post.hashtags === 'string' ? JSON.parse(post.hashtags) : post.hashtags,
          // Parse mentions JSON if it's a string
          mentions: typeof post.mentions === 'string' ? JSON.parse(post.mentions) : post.mentions,
          // Parse ocrTexts JSON if it's a string
          ocrTexts: typeof post.ocrTexts === 'string' ? JSON.parse(post.ocrTexts) : post.ocrTexts,
          // Parse imageDescriptions JSON if it's a string
          imageDescriptions:
            typeof post.imageDescriptions === 'string'
              ? JSON.parse(post.imageDescriptions)
              : post.imageDescriptions,
          // Parse slideClassifications JSON if it's a string
          slideClassifications:
            typeof post.slideClassifications === 'string'
              ? JSON.parse(post.slideClassifications)
              : post.slideClassifications,
        },
      })),
    };

    // Serialize BigInt values before returning
    const serializedProject = serializeBigInt(processedProject);
    return NextResponse.json(serializedProject);
  } catch (error) {
    console.error('[Mobile API] Failed to fetch project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
