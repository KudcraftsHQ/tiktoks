import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { uploadToR2 } from '@/lib/r2'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

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
      // Get image dimensions
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
      const { url, key } = await uploadToR2(file, 'assets/uploads')

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

      // Create asset entry
      const asset = await prisma.asset.create({
        data: {
          folderId: folderId || null,
          cacheAssetId: cacheAsset.id,
          name: file.name,
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
