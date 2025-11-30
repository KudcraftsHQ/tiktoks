import { NextRequest, NextResponse } from 'next/server'
import { paraphraseSingleExample, ParaphraseIntensity } from '@/lib/minimal-paraphrase-service'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, slideType, intensity = 'minimal', draftId } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      )
    }

    if (!slideType || !['HOOK', 'CONTENT', 'CTA'].includes(slideType)) {
      return NextResponse.json(
        { error: 'Invalid slide type. Must be HOOK, CONTENT, or CTA' },
        { status: 400 }
      )
    }

    if (!['minimal', 'medium', 'high'].includes(intensity)) {
      return NextResponse.json(
        { error: 'Invalid intensity. Must be minimal, medium, or high' },
        { status: 400 }
      )
    }

    // For CTA slides, fetch product context from draft (following same pattern as coherence analysis)
    let productContext: { title: string; description: string } | null = null
    if (slideType === 'CTA' && draftId) {
      console.log(`🔍 [QuickParaphrase] Fetching product context for CTA slide from draft: ${draftId}`)

      const draft = await prisma.remixPost.findUnique({
        where: { id: draftId },
        select: {
          productContext: {
            select: {
              id: true,
              title: true,
              description: true
            }
          },
          project: {
            select: {
              productContext: {
                select: {
                  id: true,
                  title: true,
                  description: true
                }
              }
            }
          }
        }
      })

      // Priority: draft-level > project-level (same as coherence analysis)
      const pc = draft?.productContext || draft?.project?.productContext || null

      if (pc) {
        productContext = {
          title: pc.title,
          description: pc.description || ''
        }
        console.log(`✅ [QuickParaphrase] Found product context: ${pc.title}`)
      } else {
        console.log(`⚠️ [QuickParaphrase] No product context found for draft`)
      }
    } else if (slideType === 'CTA') {
      console.log(`⚠️ [QuickParaphrase] CTA slide but no draftId provided`)
    }

    // If CTA with product context, enhance the text with product context before paraphrasing
    let textToParaphrase = text
    if (slideType === 'CTA' && productContext) {
      // The paraphrase service will handle embedding the product context
      // We'll modify the minimal-paraphrase-service to accept product context
      textToParaphrase = text
    }

    const paraphrasedText = await paraphraseSingleExample(
      textToParaphrase,
      slideType as 'HOOK' | 'CONTENT' | 'CTA',
      intensity as ParaphraseIntensity,
      productContext || undefined
    )

    return NextResponse.json({ paraphrasedText })
  } catch (error) {
    console.error('Quick paraphrase error:', error)
    return NextResponse.json(
      { error: 'Failed to paraphrase text' },
      { status: 500 }
    )
  }
}
