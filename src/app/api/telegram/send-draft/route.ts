import { NextRequest, NextResponse } from 'next/server'
import { cacheAssetService } from '@/lib/cache-asset-service'

const TELEGRAM_BOT_API_TOKEN = process.env.TELEGRAM_BOT_API_TOKEN
const TELEGRAM_BOT_CHAT_ID = process.env.TELEGRAM_BOT_CHAT_ID

interface Slide {
  paraphrasedText?: string
  backgroundLayers?: Array<{
    type: string
    cacheAssetId?: string
  }>
}

interface SendDraftRequest {
  draftName: string
  draftDescription?: string
  slides: Slide[]
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Telegram] Starting draft send process')

    if (!TELEGRAM_BOT_API_TOKEN || !TELEGRAM_BOT_CHAT_ID) {
      console.error('[Telegram] Missing configuration:', {
        hasToken: !!TELEGRAM_BOT_API_TOKEN,
        hasChatId: !!TELEGRAM_BOT_CHAT_ID
      })
      return NextResponse.json(
        { error: 'Telegram configuration missing' },
        { status: 500 }
      )
    }

    const body: SendDraftRequest = await request.json()
    const { draftName, draftDescription, slides } = body

    console.log('[Telegram] Draft details:', {
      draftName,
      hasDescription: !!draftDescription,
      slideCount: slides.length
    })

    // Send draft title and description
    const headerText = `📋 *${escapeMarkdown(draftName)}*${
      draftDescription ? `\n\n${escapeMarkdown(draftDescription)}` : ''
    }`

    console.log('[Telegram] Sending header message')
    await sendTelegramMessage(headerText)

    // Send each slide with image and caption
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      const slideNumber = i + 1
      const slideLabel = `*Slide ${slideNumber}*`
      const slideText = escapeMarkdown(slide.paraphrasedText || 'No text')

      // Find background image
      const backgroundImage = slide.backgroundLayers?.find(
        (layer) => layer.type === 'image' && layer.cacheAssetId
      )

      console.log(`[Telegram] Processing slide ${slideNumber}:`, {
        hasBackgroundImage: !!backgroundImage,
        cacheAssetId: backgroundImage?.cacheAssetId,
        textLength: slide.paraphrasedText?.length || 0
      })

      if (backgroundImage?.cacheAssetId) {
        // Send slide image with just the slide number as caption
        await sendTelegramPhoto(backgroundImage.cacheAssetId, slideLabel)
        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 300))
        // Send slide text as separate message
        await sendTelegramMessage(slideText)
      } else {
        // Send slide label
        await sendTelegramMessage(slideLabel)
        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 300))
        // Send slide text
        await sendTelegramMessage(slideText)
      }

      // Small delay between slides to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    console.log('[Telegram] Draft sent successfully')
    return NextResponse.json({
      success: true,
      message: 'Draft sent to Telegram successfully'
    })
  } catch (error) {
    console.error('[Telegram] Failed to send draft:', error)
    console.error('[Telegram] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        error: 'Failed to send draft to Telegram',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function sendTelegramMessage(text: string) {
  console.log('[Telegram] Sending text message, length:', text.length)

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_API_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_BOT_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    console.error('[Telegram] sendMessage failed:', error)
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`)
  }

  console.log('[Telegram] Text message sent successfully')
  return response.json()
}

async function sendTelegramPhoto(cacheAssetId: string, caption: string) {
  console.log('[Telegram] Attempting to send photo for cache asset:', cacheAssetId)

  // Get presigned URL from cache asset service
  // preferPublic=true to get public URL that Telegram can access
  const imageUrl = await cacheAssetService.getUrl(cacheAssetId, undefined, true)

  if (!imageUrl) {
    console.error('[Telegram] No URL generated for cache asset:', cacheAssetId)
    throw new Error('Failed to generate image URL from cache asset')
  }

  console.log('[Telegram] Generated image URL:', {
    cacheAssetId,
    imageUrl,
    urlLength: imageUrl.length,
    captionLength: caption.length
  })

  const requestBody = {
    chat_id: TELEGRAM_BOT_CHAT_ID,
    photo: imageUrl,
    caption,
    parse_mode: 'Markdown',
  }

  console.log('[Telegram] Sending photo to Telegram')

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_API_TOKEN}/sendPhoto`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    console.error('[Telegram] sendPhoto failed:', {
      error,
      imageUrl: imageUrl.substring(0, 100) + '...', // Truncate URL in logs
      cacheAssetId,
      statusCode: response.status
    })
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`)
  }

  console.log('[Telegram] Photo sent successfully')
  return response.json()
}

function escapeMarkdown(text: string): string {
  // Escape special characters for Telegram Markdown
  // Only escape: _ * [ ] ( ) ~ ` > + = | { }
  // NOT escaping: . ! - # (these are not special in Telegram Markdown, # is kept for hashtags)
  return text.replace(/([_*\[\]()~`>+|{}])/g, '\\$1')
}
