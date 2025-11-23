import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { uploadToR2 } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import heicConvert from 'heic-convert'
import { analyzeFileBuffer } from '@/lib/file-type-detector'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const folderId = formData.get('folderId') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadedAssets = []

    for (const file of files) {
      let buffer = Buffer.from(await file.arrayBuffer())
      let contentType = file.type
      let fileName = file.name

      // Detect and convert HEIC files
      if (file.type.startsWith('image/')) {
        const fileAnalysis = analyzeFileBuffer(buffer, file.name, file.type)

        if (fileAnalysis.detectedType.format === 'HEIC/HEIF') {
          console.log(`🔄 [AssetUpload] Converting HEIC to JPEG: ${file.name}`)
          try {
            const convertedBuffer = await heicConvert({
              buffer,
              format: 'JPEG',
              quality: 0.92
            })
            buffer = Buffer.from(convertedBuffer)
            contentType = 'image/jpeg'
            // Update filename extension
            const lastDot = fileName.lastIndexOf('.')
            fileName = lastDot !== -1 ? fileName.substring(0, lastDot) + '.jpg' : fileName + '.jpg'
            console.log(`✅ [AssetUpload] HEIC conversion completed: ${fileName}`)
          } catch (conversionError) {
            console.error(`❌ [AssetUpload] HEIC conversion failed:`, conversionError)
            // Continue with original buffer if conversion fails
          }
        }
      }

      // Get image dimensions
      let width: number | null = null
      let height: number | null = null

      if (contentType.startsWith('image/')) {
        try {
          const metadata = await sharp(buffer).metadata()
          width = metadata.width || null
          height = metadata.height || null
        } catch (error) {
          console.warn('Could not extract image metadata:', error)
        }
      }

      // Upload to R2
      const { url, key } = await uploadToR2(buffer, 'assets/uploads', fileName, contentType)

      // Create cache asset
      const cacheAsset = await prisma.cacheAsset.create({
        data: {
          id: uuidv4(),
          originalUrl: url,
          cacheKey: key,
          status: CacheStatus.CACHED,
          contentType,
          fileSize: buffer.length,
          cachedAt: new Date()
        }
      })

      // Create asset entry
      const asset = await prisma.asset.create({
        data: {
          folderId: folderId || null,
          cacheAssetId: cacheAsset.id,
          name: fileName,
          width,
          height
        }
      })

      uploadedAssets.push({
        ...asset,
        url
      })
    }

    return NextResponse.json({
      success: true,
      assets: uploadedAssets
    })
  } catch (error) {
    console.error('Failed to upload assets:', error)
    return NextResponse.json(
      { error: 'Failed to upload assets' },
      { status: 500 }
    )
  }
}
