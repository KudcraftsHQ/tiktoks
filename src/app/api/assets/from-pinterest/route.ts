import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { uploadToR2 } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import heicConvert from 'heic-convert'
import { analyzeFileBuffer } from '@/lib/file-type-detector'
import { computeImageHash, areSimilarImages } from '@/lib/image-hash-service'

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
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
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
          {
            status: 409,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          }
        )
      }
    }

    // Get or create Pinterest folder
    const folder = await getOrCreatePinterestFolder()

    // Download image
    let imageBuffer = await downloadImage(imageUrl)

    // Determine file extension from URL or content type
    const urlPath = new URL(imageUrl).pathname
    let extension = urlPath.split('.').pop() || 'jpg'
    let fileName = name || `pinterest-${Date.now()}.${extension}`
    let contentType = `image/${extension}`

    // Detect and convert HEIC files
    const fileAnalysis = analyzeFileBuffer(imageBuffer, fileName, contentType)

    if (fileAnalysis.detectedType.format === 'HEIC/HEIF') {
      console.log(`🔄 [PinterestAsset] Converting HEIC to JPEG: ${fileName}`)
      try {
        const convertedBuffer = await heicConvert({
          buffer: imageBuffer,
          format: 'JPEG',
          quality: 0.92
        })
        imageBuffer = Buffer.from(convertedBuffer)
        contentType = 'image/jpeg'
        extension = 'jpg'
        // Update filename extension
        const lastDot = fileName.lastIndexOf('.')
        fileName = lastDot !== -1 ? fileName.substring(0, lastDot) + '.jpg' : fileName + '.jpg'
        console.log(`✅ [PinterestAsset] HEIC conversion completed: ${fileName}`)
      } catch (conversionError) {
        console.error(`❌ [PinterestAsset] HEIC conversion failed:`, conversionError)
        // Continue with original buffer if conversion fails
      }
    }

    // Extract image dimensions and compute hash
    let width: number | null = null
    let height: number | null = null
    let imageHash: string | null = null
    try {
      const metadata = await sharp(imageBuffer).metadata()
      width = metadata.width || null
      height = metadata.height || null

      // Compute perceptual hash for deduplication
      imageHash = await computeImageHash(imageBuffer)
      console.log(`🔑 [PinterestAsset] Computed hash: ${imageHash}`)

      // Check for duplicate images (within similarity threshold)
      const existingAssets = await prisma.asset.findMany({
        where: {
          imageHash: {
            not: null
          }
        },
        select: {
          id: true,
          imageHash: true,
          name: true,
          sourceUrl: true
        }
      })

      // Find similar images
      for (const existing of existingAssets) {
        if (existing.imageHash && areSimilarImages(imageHash, existing.imageHash)) {
          console.log(`⚠️ [PinterestAsset] Duplicate detected: ${existing.name} (ID: ${existing.id})`)
          return NextResponse.json(
            {
              error: 'Duplicate image detected',
              code: 'DUPLICATE_IMAGE',
              existingAssetId: existing.id,
              existingAssetName: existing.name,
              existingSourceUrl: existing.sourceUrl,
              message: `This image is very similar to "${existing.name}"`
            },
            {
              status: 409,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
              }
            }
          )
        }
      }
    } catch (error) {
      console.warn('Could not extract image metadata or compute hash:', error)
      // Continue without hash if computation fails
    }

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
        sourceUrl: pinUrl,
        imageHash
      }
    })

    return NextResponse.json(
      {
        success: true,
        asset: {
          ...asset,
          url
        }
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  } catch (error) {
    console.error('Failed to upload Pinterest asset:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload Pinterest asset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
