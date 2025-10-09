import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { CANVAS_SIZES, RemixSlideSchema, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema'

const prisma = new PrismaClient()

function safeParseArray(value: any): any[] {
  if (!value) return []
  try {
    if (Array.isArray(value)) return value
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn('Failed to parse array value:', error)
    return []
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const remixId = resolvedParams.id

  if (!remixId) {
    return NextResponse.json({ error: 'Remix ID is required' }, { status: 400 })
  }

  try {
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        originalPost: true
      }
    })

    if (!remix || !remix.originalPost) {
      return NextResponse.json({ error: 'Remix not found' }, { status: 404 })
    }

    const originalPost = remix.originalPost

    const imageDescriptions = safeParseArray(originalPost.imageDescriptions).map((entry: any) => entry?.imageDescription).filter(Boolean)
    const ocrTexts = safeParseArray(originalPost.ocrTexts).map((entry: any) => entry?.text).filter(Boolean)

    const slideTexts: string[] = imageDescriptions.length > 0
      ? imageDescriptions
      : (ocrTexts.length > 0 ? ocrTexts : (originalPost.description ? originalPost.description.split('\n').filter(Boolean) : []))

    if (slideTexts.length === 0) {
      return NextResponse.json({ error: 'No source text available to generate slides' }, { status: 400 })
    }

    const slides = slideTexts.map((text, index) => {
      const baseSlide = {
        id: `auto_${Date.now()}_${index}`,
        displayOrder: index,
        canvas: CANVAS_SIZES.INSTAGRAM_STORY,
        viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
        backgroundLayers: createDefaultBackgroundLayers(),
        originalImageIndex: index,
        paraphrasedText: text,
        originalText: text,
        textBoxes: [
          {
            id: `auto_text_${Date.now()}_${index}`,
            text,
            x: 0.1,
            y: 0.15,
            width: 0.8,
            height: 0.4,
            fontSize: 48,
            fontFamily: 'Poppins',
            fontWeight: '600',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#111111',
            textAlign: 'center',
            zIndex: 5,
            textWrap: 'wrap',
            enableShadow: true,
            shadowColor: '#000000',
            shadowBlur: 4,
            shadowOffsetX: 1,
            shadowOffsetY: 1,
            outlineWidth: 0,
            outlineColor: '#000000',
            backgroundColor: '#ffffff',
            backgroundOpacity: 0.85,
            borderRadius: 16,
            paddingTop: 24,
            paddingRight: 28,
            paddingBottom: 24,
            paddingLeft: 28,
            lineHeight: 1.25,
            letterSpacing: 0,
            transform: {
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              skewX: 0,
              skewY: 0
            },
            lockAspectRatio: false
          }
        ]
      }

      return RemixSlideSchema.parse(baseSlide)
    })

    return NextResponse.json({ slides })
  } catch (error) {
    console.error(`❌ [API] Failed to auto-generate remix slides for ${remixId}:`, error)
    return NextResponse.json({ error: 'Failed to auto-generate slides' }, { status: 500 })
  }
}
