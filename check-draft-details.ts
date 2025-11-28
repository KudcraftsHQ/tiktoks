import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function checkDraftDetails() {
  const draft = await prisma.remixPost.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      slideClassifications: true,
      originalPost: {
        select: {
          id: true,
          ocrData: true
        }
      }
    }
  })

  if (!draft) {
    console.log('No drafts found')
    await prisma.$disconnect()
    return
  }

  console.log('Draft:', draft.name)
  console.log('Created:', draft.createdAt)
  console.log('\nOriginal Post:', draft.originalPost?.id || 'none')

  if (draft.originalPost?.ocrData) {
    const ocrData = typeof draft.originalPost.ocrData === 'string'
      ? JSON.parse(draft.originalPost.ocrData)
      : draft.originalPost.ocrData

    console.log('\nOCR Data structure:', Object.keys(ocrData))
    if (Array.isArray(ocrData.slides)) {
      console.log('OCR Slides:', ocrData.slides.length)
      ocrData.slides.forEach((slide: any, i: number) => {
        console.log(`  ${i}: type=${slide.slideType}`)
      })
    }
  }

  await prisma.$disconnect()
}

checkDraftDetails().catch(console.error)
