import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI } from '@google/genai'

const prisma = new PrismaClient()

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

interface TopicSuggestion {
  topic: string
  angle: string
  description: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, count = 3 } = body

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Fetch project with reference posts
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        posts: {
          include: {
            post: {
              select: {
                id: true,
                description: true,
                ocrTexts: true,
                imageDescriptions: true,
                slideClassifications: true,
                postCategory: { select: { name: true } }
              }
            }
          },
          take: 10
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Build reference context from posts
    let referenceContext = ''
    if (project.posts.length > 0) {
      const postContexts = project.posts.map((p, idx) => {
        const post = p.post
        // Handle ocrTexts which can be a string (JSON) or an array of objects
        const rawOcrTexts = typeof post.ocrTexts === 'string'
          ? JSON.parse(post.ocrTexts)
          : post.ocrTexts

        const ocrText = Array.isArray(rawOcrTexts)
          ? rawOcrTexts
              .filter((t: any) => t.success && t.text)
              .map((t: any) => `  Slide ${t.imageIndex + 1}: ${t.text}`)
              .join('\n')
          : ''

        const category = post.postCategory?.name || 'Uncategorized'
        const description = post.description || 'No description'

        return `Reference Post ${idx + 1}:
- Category: ${category}
- Description: ${description}
- Content:
${ocrText || '  No text extracted'}`
      }).join('\n\n')

      referenceContext = postContexts
    }

    if (!referenceContext) {
      return NextResponse.json(
        { error: 'No reference posts found in project. Add reference posts first.' },
        { status: 400 }
      )
    }

    // Use AI to generate topic suggestions
    const prompt = `You are a viral TikTok content strategist. Analyze these reference posts and suggest ${count} fresh carousel topic ideas.

**REFERENCE POSTS:**
${referenceContext}

**YOUR TASK:**
Based on the themes, styles, and topics in these reference posts, suggest ${count} NEW carousel topic ideas that:
1. Follow similar themes but offer fresh angles
2. Would appeal to the same audience
3. Have viral potential (curiosity-inducing, relatable, actionable)
4. Are specific enough to create a focused carousel

For each suggestion, provide:
- topic: A concise carousel topic (like "5 ways to grow your LinkedIn following" or "Why most people fail at building habits")
- angle: The unique perspective or hook (2-5 words)
- description: A brief explanation of what the carousel would cover (1 sentence)

**IMPORTANT RULES:**
- Each topic should feel like a natural extension of the reference content
- Vary the angles (listicle, myth-busting, personal story, how-to, why question, etc.)
- Make topics specific and actionable, not generic
- Topics should be different from each other

Respond with a JSON array only:
[
  {
    "topic": "the carousel topic",
    "angle": "unique angle",
    "description": "what this covers"
  }
]`

    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
    })

    const responseText = response.text || ''

    // Parse AI response
    let suggestions: TopicSuggestion[] = []
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Failed to parse AI suggestions:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI suggestions' },
        { status: 500 }
      )
    }

    // Validate and clean suggestions
    suggestions = suggestions
      .filter(s => s.topic && typeof s.topic === 'string')
      .slice(0, count)
      .map(s => ({
        topic: s.topic.trim(),
        angle: s.angle?.trim() || '',
        description: s.description?.trim() || ''
      }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error suggesting topics:', error)
    return NextResponse.json(
      { error: 'Failed to suggest topics' },
      { status: 500 }
    )
  }
}
