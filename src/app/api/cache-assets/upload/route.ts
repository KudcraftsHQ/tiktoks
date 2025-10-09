import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import { PrismaClient, CacheStatus } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const folder = (formData.get('folder') as string) || 'remix/uploads'

    const { url, key } = await uploadToR2(file, folder)

    const cacheAsset = await prisma.cacheAsset.create({
      data: {
        originalUrl: url,
        cacheKey: key,
        status: CacheStatus.CACHED,
        contentType: file.type,
        fileSize: file.size,
        cachedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      cacheAssetId: cacheAsset.id,
      url
    })
  } catch (error) {
    console.error('💥 [Cache Assets Upload API] Failed to upload image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
