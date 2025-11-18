import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { uploadToR2 } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

const prisma = new PrismaClient()

const PINTEREST_FOLDER_NAME = 'Pinterest'

/**
 * Get or create the shared Pinterest folder
 */
async function getOrCreatePinterestFolder() {
  let folder = await prisma.assetFolder.findFirst({
    where: { name: PINTEREST_FOLDER_NAME }
  })

  if (!folder) {
    folder = await prisma.assetFolder.create({
      data: { name: PINTEREST_FOLDER_NAME }
    })
  }

  return folder
}

/**
 * Download image from URL and return as buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * POST /api/assets/from-pinterest
 * Upload a Pinterest pin image to assets
 *
 * Request body:
 * {
 *   imageUrl: string,      // Direct image URL to download
 *   pinUrl: string,        // Pinterest pin URL for deduplication
 *   name?: string,         // Optional custom name
 *   force?: boolean        // Force re-upload even if exists
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl, pinUrl, name, force = false } = body

    // Validate required fields
    if (!imageUrl || !pinUrl) {
      return NextResponse.json(
        { error: 'imageUrl and pinUrl are required' },
        { status: 400 }
      )
    }

    // Check for duplicate (unless force mode)
    if (!force) {
      const existingAsset = await prisma.asset.findFirst({
        where: {
          sourceType: 'pinterest',
          sourceUrl: pinUrl
        }
      })

      if (existingAsset) {
        return NextResponse.json(
          {
            error: 'Asset already exists',
            code: 'DUPLICATE_ASSET',
            existingAssetId: existingAsset.id
          },
          { status: 409 }
        )
      }
    }

    // Get or create Pinterest folder
    const folder = await getOrCreatePinterestFolder()

    // Download image
    const imageBuffer = await downloadImage(imageUrl)

    // Extract image dimensions
    let width: number | null = null
    let height: number | null = null
    try {
      const metadata = await sharp(imageBuffer).metadata()
      width = metadata.width || null
      height = metadata.height || null
    } catch (error) {
      console.warn('Could not extract image metadata:', error)
    }

    // Determine file extension from URL or content type
    const urlPath = new URL(imageUrl).pathname
    const extension = urlPath.split('.').pop() || 'jpg'
    const fileName = name || `pinterest-${Date.now()}.${extension}`
    const contentType = `image/${extension}`

    // Upload to R2 (using Buffer directly)
    const { url, key } = await uploadToR2(imageBuffer, 'assets/pinterest', fileName, contentType)

    // Create cache asset
    const cacheAsset = await prisma.cacheAsset.create({
      data: {
        id: uuidv4(),
        originalUrl: url,
        cacheKey: key,
        status: CacheStatus.CACHED,
        contentType: contentType,
        fileSize: imageBuffer.length,
        cachedAt: new Date()
      }
    })

    // Create asset entry
    const asset = await prisma.asset.create({
      data: {
        folderId: folder.id,
        cacheAssetId: cacheAsset.id,
        name: fileName,
        width,
        height,
        sourceType: 'pinterest',
        sourceUrl: pinUrl
      }
    })

    return NextResponse.json({
      success: true,
      asset: {
        ...asset,
        url
      }
    })
  } catch (error) {
    console.error('Failed to upload Pinterest asset:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload Pinterest asset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
