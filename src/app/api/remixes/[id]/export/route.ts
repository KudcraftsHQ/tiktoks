import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import JSZip from 'jszip'
import { uploadToR2 } from '@/lib/r2'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

// Initialize R2 client
function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })
}

/**
 * POST /api/remixes/[id]/export
 * Generate ZIP file with draft content and background images
 * Uploads to R2 with 1-day expiration, returns presigned download URL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remixId } = await params

    // Fetch remix with project information
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        project: {
          select: {
            name: true
          }
        }
      }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Parse slides
    const slides = typeof remix.slides === 'string'
      ? JSON.parse(remix.slides)
      : (Array.isArray(remix.slides) ? remix.slides : [])

    if (slides.length === 0) {
      return NextResponse.json(
        { error: 'Draft has no slides to export' },
        { status: 400 }
      )
    }

    // Create ZIP
    const zip = new JSZip()

    // Sanitize names for filenames
    const projectName = remix.project?.name?.replace(/[^a-z0-9]/gi, '-') || 'project'
    const draftName = remix.name.replace(/[^a-z0-9]/gi, '-')

    // Add background images
    let imageCount = 0
    for (const [index, slide] of slides.entries()) {
      const bgLayer = slide.backgroundLayers?.[0]

      if (bgLayer?.type === 'image' && bgLayer.cacheAssetId) {
        try {
          // Get image URL from cache asset service
          const imageUrl = await cacheAssetService.getUrl(bgLayer.cacheAssetId)

          // Fetch image
          const imageResponse = await fetch(imageUrl)
          if (!imageResponse.ok) {
            console.warn(`Failed to fetch image for slide ${index}:`, imageResponse.statusText)
            continue
          }

          // Get image data
          const imageBuffer = await imageResponse.arrayBuffer()

          // Determine file extension
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          const ext = contentType.includes('png') ? 'png' :
                     contentType.includes('webp') ? 'webp' : 'jpg'

          // Add to ZIP
          const filename = `${projectName}-${draftName}-${index}.${ext}`
          zip.file(filename, imageBuffer)
          imageCount++
        } catch (error) {
          console.error(`Failed to add image for slide ${index}:`, error)
        }
      }
    }

    // Generate content.md
    const markdownSections: string[] = []

    // Draft metadata
    markdownSections.push(`# ${remix.name}`)
    markdownSections.push('')

    if (remix.description) {
      markdownSections.push('## Description')
      markdownSections.push('')
      markdownSections.push(remix.description)
      markdownSections.push('')
    }

    // Parse slide classifications
    let slideClassifications: Array<{ slideIndex: number; type: string }> = []
    try {
      if (remix.slideClassifications) {
        const parsed = typeof remix.slideClassifications === 'string'
          ? JSON.parse(remix.slideClassifications)
          : remix.slideClassifications
        slideClassifications = Array.isArray(parsed) ? parsed : []
      }
    } catch {
      slideClassifications = []
    }

    // Slides content
    if (slides.length > 0) {
      markdownSections.push('## Content')
      markdownSections.push('')

      slides.forEach((slide: any, slideIndex: number) => {
        const classification = slideClassifications.find(c => c.slideIndex === slideIndex)
        const slideType = classification?.type || 'unknown'

        markdownSections.push(`### Slide ${slideIndex + 1} - ${slideType}`)
        markdownSections.push('')
        markdownSections.push(slide.paraphrasedText || '')
        markdownSections.push('')
      })
    }

    const markdownContent = markdownSections.join('\n')
    zip.file('content.md', markdownContent)

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // Upload to R2 in exports folder
    const zipFilename = `${projectName}-${draftName}-${Date.now()}.zip`
    const { key } = await uploadToR2(
      zipBuffer,
      'exports',
      zipFilename,
      'application/zip'
    )

    // Generate presigned URL with 1-day expiration
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })

    const downloadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: 86400 // 1 day in seconds
    })

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString()

    return NextResponse.json({
      downloadUrl,
      expiresAt,
      filename: zipFilename,
      size: zipBuffer.length,
      imageCount,
      slideCount: slides.length
    })
  } catch (error) {
    console.error('Failed to generate export:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate export',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
