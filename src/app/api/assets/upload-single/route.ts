import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { uploadToR2 } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import heicConvert from 'heic-convert'
import { analyzeFileBuffer } from '@/lib/file-type-detector'
import { detectFace } from '@/lib/face-detection-service'
import { computeImageHash, areSimilarImages } from '@/lib/image-hash-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided', code: 'INVALID_FILE' },
        { status: 400 }
      )
    }

    let buffer = Buffer.from(await file.arrayBuffer())
    let contentType = file.type
    let fileName = file.name

    // Always analyze file buffer to detect HEIC (browser may not set correct MIME type)
    const fileAnalysis = analyzeFileBuffer(buffer, file.name, file.type)

    // Detect and convert HEIC files
    if (fileAnalysis.detectedType.format === 'HEIC/HEIF') {
      console.log(`🔄 [AssetUpload] Converting HEIC to JPEG: ${file.name}`)
      try {
        const convertedBuffer = await heicConvert({
          buffer,
          format: 'JPEG',
          quality: 0.92,
        })
        buffer = Buffer.from(convertedBuffer)
        contentType = 'image/jpeg'
        // Update filename extension
        const lastDot = fileName.lastIndexOf('.')
        fileName =
          lastDot !== -1 ? fileName.substring(0, lastDot) + '.jpg' : fileName + '.jpg'
        console.log(`✅ [AssetUpload] HEIC conversion completed: ${fileName}`)
      } catch (conversionError) {
        console.error(`❌ [AssetUpload] HEIC conversion failed:`, conversionError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to convert HEIC image',
            code: 'CONVERSION_FAILED',
            details: {
              stage: 'conversion',
              originalError: String(conversionError),
            },
          },
          { status: 500 }
        )
      }
    }

    // If still not an image type, use detected type from file analysis
    if (!contentType || (!contentType.startsWith('image/') && !contentType.startsWith('application/'))) {
      contentType = fileAnalysis.detectedType.mimeType
    }

    // Get image dimensions and compute hash
    let width: number | null = null
    let height: number | null = null
    let imageHash: string | null = null

    if (contentType.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer).metadata()
        width = metadata.width || null
        height = metadata.height || null

        // Compute perceptual hash for deduplication
        imageHash = await computeImageHash(buffer)
        console.log(`🔑 [AssetUpload] Computed hash: ${imageHash}`)

        // Check for duplicate images (within similarity threshold)
        const existingAssets = await prisma.asset.findMany({
          where: {
            imageHash: {
              not: null,
            },
          },
          select: {
            id: true,
            imageHash: true,
            name: true,
          },
        })

        // Find similar images - return duplicate response if found
        for (const existing of existingAssets) {
          if (existing.imageHash && areSimilarImages(imageHash, existing.imageHash)) {
            console.log(
              `⏭️ [AssetUpload] Duplicate detected: ${fileName} (similar to ${existing.name})`
            )
            return NextResponse.json(
              {
                success: true,
                duplicate: true,
                message: 'This image already exists in your library',
                existingAssetId: existing.id,
              },
              { status: 200 }
            )
          }
        }
      } catch (error) {
        console.warn('Could not extract image metadata or compute hash:', error)
        // Continue without hash if computation fails
      }
    }

    // Upload to R2
    let url: string
    let key: string
    try {
      const uploadResult = await uploadToR2(buffer, 'assets/uploads', fileName, contentType)
      url = uploadResult.url
      key = uploadResult.key
    } catch (error) {
      console.error('R2 upload failed:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upload file to storage',
          code: 'UPLOAD_ERROR',
          details: {
            stage: 'upload',
            originalError: String(error),
          },
        },
        { status: 500 }
      )
    }

    // Create cache asset
    const cacheAsset = await prisma.cacheAsset.create({
      data: {
        id: uuidv4(),
        originalUrl: url,
        cacheKey: key,
        status: CacheStatus.CACHED,
        contentType,
        fileSize: buffer.length,
        cachedAt: new Date(),
      },
    })

    // Create asset entry
    const asset = await prisma.asset.create({
      data: {
        folderId: folderId || null,
        cacheAssetId: cacheAsset.id,
        name: fileName,
        width,
        height,
        imageHash,
      },
    })

    // Auto-detect face in the uploaded image
    let hasFace: boolean | null = null
    let faceAnalyzedAt: Date | null = null
    try {
      const faceResult = await detectFace(cacheAsset.id)
      hasFace = faceResult.hasFace
      faceAnalyzedAt = new Date()

      // Update asset with face detection result
      await prisma.asset.update({
        where: { id: asset.id },
        data: { hasFace, faceAnalyzedAt },
      })
    } catch (faceError) {
      console.warn('Face detection failed for asset:', asset.id, faceError)
      // Continue without face detection - don't fail the upload
    }

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        folderId: asset.folderId,
        cacheAssetId: asset.cacheAssetId,
        name: fileName,
        url,
        width,
        height,
        hasFace,
        createdAt: asset.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to upload asset:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload asset',
        code: 'SERVER_ERROR',
        details: {
          stage: 'unknown',
          originalError: String(error),
        },
      },
      { status: 500 }
    )
  }
}
