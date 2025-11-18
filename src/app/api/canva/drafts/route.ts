import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

// Helper function to convert BigInt and Date values for JSON serialization
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString()
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeBigInt(obj[key])
      }
    }
    return serialized
  }

  return obj
}

// CORS headers for Canva integration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    // Get all drafts from all projects, ordered by newest updated first
    const drafts = await prisma.remixPost.findMany({
      where: {
        isDraft: true,
        projectId: {
          not: null // Only include drafts that belong to a project
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true
          }
        },
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Process drafts to add presigned URLs for background images
    const draftsWithUrls = await Promise.all(
      drafts.map(async (draft) => {
        // Parse slides from JSON
        let slides: any[] = []
        try {
          slides = typeof draft.slides === 'string'
            ? JSON.parse(draft.slides)
            : (Array.isArray(draft.slides) ? draft.slides : [])
        } catch (error) {
          console.error(`Failed to parse slides for draft ${draft.id}:`, error)
        }

        // Collect all unique cacheAssetIds from all slides
        const cacheAssetIds = new Set<string>()
        slides.forEach((slide: any) => {
          slide.backgroundLayers?.forEach((layer: any) => {
            if (layer.type === 'image' && layer.cacheAssetId) {
              cacheAssetIds.add(layer.cacheAssetId)
            }
          })
        })

        // Bulk fetch all URLs at once
        const urlMap = await cacheAssetService.getUrls(Array.from(cacheAssetIds))

        // Add URLs to each background layer
        const slidesWithUrls = slides.map((slide: any) => ({
          ...slide,
          backgroundLayers: slide.backgroundLayers?.map((layer: any) => {
            if (layer.type === 'image' && layer.cacheAssetId) {
              return {
                ...layer,
                imageUrl: urlMap[layer.cacheAssetId] || null
              }
            }
            return layer
          })
        }))

        return {
          ...draft,
          slides: slidesWithUrls
        }
      })
    )

    // Serialize BigInt values before returning
    const serializedDrafts = serializeBigInt(draftsWithUrls)

    return NextResponse.json(
      {
        drafts: serializedDrafts,
        count: drafts.length
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Failed to fetch drafts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500, headers: corsHeaders }
    )
  }
}
