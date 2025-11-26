import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * GET /api/mobile/projects
 * Fetch projects list for mobile interface
 * Read-only endpoint - only returns projects with drafts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100); // Max 100
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      // Only show projects that have at least one bookmarked draft
      remixes: {
        some: {
          isDraft: true,
          bookmarked: true,
        },
      },
    };

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive' as const,
          },
        },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: {
              posts: true,
              remixes: {
                where: {
                  isDraft: true,
                  bookmarked: true,
                },
              },
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    const hasMore = skip + limit < total;

    return NextResponse.json({
      projects,
      hasMore,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[Mobile API] Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}
