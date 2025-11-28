import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function checkOCRClassifications() {
  const post = await prisma.tiktokPost.findFirst({
    where: {
      ocrStatus: 'completed',
      contentType: 'photo'
    },
    select: {
      id: true,
      description: true,
      ocrData: true,
      slideClassifications: true
    }
  })

  if (post) {
    const desc = post.description || ''
    console.log('Post:', desc.substring(0, 60))

    const ocrData = typeof post.ocrData === 'string'
      ? JSON.parse(post.ocrData)
      : post.ocrData

    if (ocrData && Array.isArray(ocrData.slides)) {
      console.log('\nOCR Slides:')
      ocrData.slides.forEach((slide: any, i: number) => {
        const slideType = slide.slideType || 'no type'
        console.log(`  Slide ${i}: ${slideType}`)
      })
    }
  }

  await prisma.$disconnect()
}

checkOCRClassifications().catch(console.error)
