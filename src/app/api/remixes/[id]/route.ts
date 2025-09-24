import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

const UpdateRemixSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  slides: z.array(z.object({
    id: z.string().optional(),
    displayOrder: z.number(),
    originalImageId: z.string().optional(),
    backgroundImageId: z.string().optional(),
    backgroundImagePositionX: z.number().min(0).max(1).optional(),
    backgroundImagePositionY: z.number().min(0).max(1).optional(),
    backgroundImageZoom: z.number().min(0.1).max(5).optional(),
    textBoxes: z.array(z.object({
      id: z.string().optional(),
      text: z.string(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0.01).max(1),
      height: z.number().min(0.01).max(1),
      fontSize: z.number().min(8).max(200),
      fontFamily: z.string(),
      fontWeight: z.string(),
      fontStyle: z.string(),
      textDecoration: z.string(),
      color: z.string(),
      textAlign: z.string(),
      zIndex: z.number(),
      textStroke: z.string().optional(),
      textShadow: z.string().optional(),
      borderWidth: z.number().optional(),
      borderColor: z.string().optional()
    }))
  })).optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const remixId = params.id

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        },
        originalPost: {
          include: {
            profile: true
          }
        }
      }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(remix)

  } catch (error) {
    console.error(`❌ [API] Failed to get remix ${params.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const remixId = params.id

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = UpdateRemixSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { name, description, slides } = validation.data

    console.log(`📝 [API] Updating remix: ${remixId}`)

    await prisma.$transaction(async (tx) => {
      // Update remix metadata if provided
      if (name !== undefined || description !== undefined) {
        await tx.remixPost.update({
          where: { id: remixId },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            updatedAt: new Date()
          }
        })
      }

      // Update slides if provided
      if (slides) {
        console.log(`📝 [API] Updating ${slides.length} slides`)

        for (const slideData of slides) {
          let slide

          if (slideData.id) {
            // Update existing slide
            slide = await tx.remixSlide.update({
              where: { id: slideData.id },
              data: {
                displayOrder: slideData.displayOrder,
                originalImageId: slideData.originalImageId,
                backgroundImageId: slideData.backgroundImageId,
                backgroundImagePositionX: slideData.backgroundImagePositionX ?? 0.5,
                backgroundImagePositionY: slideData.backgroundImagePositionY ?? 0.5,
                backgroundImageZoom: slideData.backgroundImageZoom ?? 1.0,
                updatedAt: new Date()
              }
            })
          } else {
            // Create new slide
            slide = await tx.remixSlide.create({
              data: {
                remixPostId: remixId,
                displayOrder: slideData.displayOrder,
                originalImageId: slideData.originalImageId,
                backgroundImageId: slideData.backgroundImageId,
                backgroundImagePositionX: slideData.backgroundImagePositionX ?? 0.5,
                backgroundImagePositionY: slideData.backgroundImagePositionY ?? 0.5,
                backgroundImageZoom: slideData.backgroundImageZoom ?? 1.0
              }
            })
          }

          // Handle text boxes
          if (slideData.textBoxes) {
            // Delete existing text boxes for this slide
            await tx.remixTextBox.deleteMany({
              where: { slideId: slide.id }
            })

            // Create new text boxes
            for (const textBoxData of slideData.textBoxes) {
              await tx.remixTextBox.create({
                data: {
                  slideId: slide.id,
                  text: textBoxData.text,
                  x: textBoxData.x,
                  y: textBoxData.y,
                  width: textBoxData.width,
                  height: textBoxData.height,
                  fontSize: textBoxData.fontSize,
                  fontFamily: textBoxData.fontFamily,
                  fontWeight: textBoxData.fontWeight,
                  fontStyle: textBoxData.fontStyle,
                  textDecoration: textBoxData.textDecoration,
                  color: textBoxData.color,
                  textAlign: textBoxData.textAlign,
                  zIndex: textBoxData.zIndex,
                  textStroke: textBoxData.textStroke,
                  textShadow: textBoxData.textShadow,
                  borderWidth: textBoxData.borderWidth,
                  borderColor: textBoxData.borderColor
                }
              })
            }
          }
        }
      }
    })

    // Get the updated remix
    const updatedRemix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    console.log(`✅ [API] Successfully updated remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Remix updated successfully',
      remix: updatedRemix
    })

  } catch (error) {
    console.error(`❌ [API] Failed to update remix ${params.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const remixId = params.id

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    // Delete the remix (cascade will handle slides and text boxes)
    await prisma.remixPost.delete({
      where: { id: remixId }
    })

    console.log(`🗑️ [API] Successfully deleted remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Remix deleted successfully'
    })

  } catch (error) {
    console.error(`❌ [API] Failed to delete remix ${params.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to delete remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}