import { NextRequest, NextResponse } from 'next/server';
import { cacheAssetService } from '@/lib/cache-asset-service';

/**
 * POST /api/mobile/get-slide-urls
 * Get presigned URLs for slide background images
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cacheAssetIds } = body;

    if (!cacheAssetIds || !Array.isArray(cacheAssetIds)) {
      return NextResponse.json(
        { error: 'cacheAssetIds array is required' },
        { status: 400 }
      );
    }

    // Filter out null/undefined values
    const validIds = cacheAssetIds.filter((id): id is string => Boolean(id));

    if (validIds.length === 0) {
      return NextResponse.json({ urls: [] });
    }

    // Get presigned URLs using CacheAssetService
    const urls = await cacheAssetService.getUrls(validIds);

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('Error getting slide URLs:', error);
    return NextResponse.json(
      { error: 'Failed to get slide URLs' },
      { status: 500 }
    );
  }
}
