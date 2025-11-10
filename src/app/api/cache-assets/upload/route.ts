import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const folder = (formData.get('folder') as string) || 'assets/uploads'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploadedAssets = []

    for (const file of files) {
      // Extract image dimensions if it's an image
      let width: number | null = null
      let height: number | null = null

      if (file.type.startsWith('image/')) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer())
          const metadata = await sharp(buffer).metadata()
          width = metadata.width || null
          height = metadata.height || null
        } catch (error) {
          console.warn('Could not extract image metadata:', error)
        }
      }

      // Upload to R2
      const { url, key } = await uploadToR2(file, folder)

      // Create cache asset
      const cacheAsset = await prisma.cacheAsset.create({
        data: {
          id: uuidv4(),
          originalUrl: url,
          cacheKey: key,
          status: CacheStatus.CACHED,
          contentType: file.type,
          fileSize: file.size,
          cachedAt: new Date()
        }
      })

      uploadedAssets.push({
        id: cacheAsset.id,
        url,
        cacheKey: key,
        contentType: file.type,
        fileSize: file.size,
        width,
        height,
        createdAt: cacheAsset.createdAt
      })
    }

    return NextResponse.json({
      success: true,
      assets: uploadedAssets
    })
  } catch (error) {
    console.error('💥 [Cache Assets Upload API] Failed to upload files:', error)
    return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 })
  }
}
