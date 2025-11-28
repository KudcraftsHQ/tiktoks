import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function testAutoFill() {
  // Get a HOOK concept
  const hookConcept = await prisma.conceptBank.findFirst({
    where: { type: 'HOOK' },
    include: { examples: true }
  })

  console.log('HOOK concept found:', hookConcept?.title)
  console.log('HOOK concept type:', hookConcept?.type)

  // Get a CTA concept
  const ctaConcept = await prisma.conceptBank.findFirst({
    where: { type: 'CTA' },
    include: { examples: true }
  })

  console.log('\nCTA concept found:', ctaConcept?.title)
  console.log('CTA concept type:', ctaConcept?.type)

  // Get a CONTENT concept
  const contentConcept = await prisma.conceptBank.findFirst({
    where: { type: 'CONTENT' },
    include: { examples: true }
  })

  console.log('\nCONTENT concept found:', contentConcept?.title)
  console.log('CONTENT concept type:', contentConcept?.type)

  // Test type comparison
  console.log('\n=== Type Comparison Tests ===')
  console.log('HOOK === "HOOK":', 'HOOK' === 'HOOK')
  console.log('CTA === "CTA":', 'CTA' === 'CTA')
  console.log('CONTENT === "CONTENT":', 'CONTENT' === 'CONTENT')
  
  // Test with a draft that has classifications
  const draft = await prisma.remixPost.findFirst({
    where: {
      slideClassifications: {
        not: '[]'
      }
    },
    select: {
      id: true,
      slideClassifications: true
    }
  })

  if (draft) {
    console.log('\n=== Draft Classifications ===')
    console.log('Draft ID:', draft.id)
    const classifications = typeof draft.slideClassifications === 'string' 
      ? JSON.parse(draft.slideClassifications)
      : draft.slideClassifications
    console.log('Classifications:', JSON.stringify(classifications, null, 2))
  }

  await prisma.$disconnect()
}

testAutoFill().catch(console.error)
