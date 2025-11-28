import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

const BASE_URL = 'http://localhost:55000'

async function testAutoFillFlow() {
  console.log('=== Testing Auto-Fill Flow ===\n')

  // Step 1: Create a new draft with 6 empty slides
  console.log('Step 1: Creating a new draft with 6 empty slides...')

  const newDraft = await prisma.remixPost.create({
    data: {
      name: 'Test Auto-Fill Draft',
      slides: [
        { id: 'slide_0', paraphrasedText: '', textBoxes: [] },
        { id: 'slide_1', paraphrasedText: '', textBoxes: [] },
        { id: 'slide_2', paraphrasedText: '', textBoxes: [] },
        { id: 'slide_3', paraphrasedText: '', textBoxes: [] },
        { id: 'slide_4', paraphrasedText: '', textBoxes: [] },
        { id: 'slide_5', paraphrasedText: '', textBoxes: [] },
      ],
      slideClassifications: [
        { slideIndex: 0, type: 'hook', categoryName: 'Hook' },
        { slideIndex: 1, type: 'content', categoryName: 'Content' },
        { slideIndex: 2, type: 'content', categoryName: 'Content' },
        { slideIndex: 3, type: 'content', categoryName: 'Content' },
        { slideIndex: 4, type: 'cta', categoryName: 'CTA' },
        { slideIndex: 5, type: 'content', categoryName: 'Content' },
      ]
    }
  })

  console.log('✅ Draft created:', newDraft.id)

  // Step 2: Get a HOOK concept
  console.log('\nStep 2: Getting a HOOK concept...')
  const hookConcept = await prisma.conceptBank.findFirst({
    where: { type: 'HOOK' },
    include: { examples: true }
  })

  if (!hookConcept || hookConcept.examples.length === 0) {
    console.error('❌ No HOOK concept with examples found!')
    await prisma.$disconnect()
    return
  }

  console.log('✅ HOOK concept:', hookConcept.title)
  console.log('   Examples:', hookConcept.examples.length)

  // Step 3: Simulate selecting the first HOOK example
  console.log('\nStep 3: Applying HOOK example to slide 0...')
  const hookExample = hookConcept.examples[0]

  const applyResponse = await fetch(`${BASE_URL}/api/remixes/${newDraft.id}/slides/0/apply-example`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exampleText: hookExample.text,
      mode: 'copy',
      conceptId: hookConcept.id,
      exampleId: hookExample.id
    })
  })

  if (!applyResponse.ok) {
    console.error('❌ Failed to apply HOOK example:', await applyResponse.text())
    await prisma.$disconnect()
    return
  }

  console.log('✅ HOOK example applied')

  // Step 4: Wait a bit then trigger auto-fill
  console.log('\nStep 4: Triggering auto-fill...')
  await new Promise(resolve => setTimeout(resolve, 500))

  const autoFillResponse = await fetch(`${BASE_URL}/api/remixes/${newDraft.id}/auto-fill-concepts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!autoFillResponse.ok) {
    console.error('❌ Auto-fill failed:', await autoFillResponse.text())
    await prisma.$disconnect()
    return
  }

  const autoFillResult = await autoFillResponse.json()
  console.log('✅ Auto-fill result:', JSON.stringify(autoFillResult, null, 2))

  // Step 5: Check the final state
  console.log('\nStep 5: Checking final draft state...')
  const finalDraft = await prisma.remixPost.findUnique({
    where: { id: newDraft.id },
    select: {
      slides: true,
      slideClassifications: true
    }
  })

  if (finalDraft) {
    const slides = typeof finalDraft.slides === 'string'
      ? JSON.parse(finalDraft.slides)
      : finalDraft.slides
    const classifications = typeof finalDraft.slideClassifications === 'string'
      ? JSON.parse(finalDraft.slideClassifications)
      : finalDraft.slideClassifications

    console.log('\n=== Final Draft State ===')
    slides.forEach((slide: any, i: number) => {
      const classification = classifications.find((c: any) => c.slideIndex === i)
      const text = slide.paraphrasedText || ''
      console.log(`Slide ${i} [${classification?.type || 'no type'}]:`)
      console.log(`  Text (${text.length} chars): ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`)
      console.log(`  Concept: ${classification?.conceptTitle || 'none'}`)
      console.log()
    })
  }

  // Step 6: Verify CTA slide got CTA concept
  console.log('=== Verification ===')
  if (autoFillResult.results && autoFillResult.results.length > 0) {
    const ctaSlide = autoFillResult.results.find((r: any) => r.slideIndex === 4)
    if (ctaSlide) {
      const ctaConcept = await prisma.conceptBank.findUnique({
        where: { id: ctaSlide.conceptId }
      })
      if (ctaConcept?.type === 'CTA') {
        console.log('✅ Slide 4 (CTA) got a CTA concept:', ctaConcept.title)
      } else {
        console.log('❌ Slide 4 (CTA) got a', ctaConcept?.type, 'concept:', ctaConcept?.title)
      }
    }

    const contentSlides = autoFillResult.results.filter((r: any) => [1, 2, 3, 5].includes(r.slideIndex))
    console.log(`\n✅ ${contentSlides.length} CONTENT slides filled`)
  }

  await prisma.$disconnect()
}

testAutoFillFlow().catch(console.error)
