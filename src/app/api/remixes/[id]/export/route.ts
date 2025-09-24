import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { remixExportService } from '@/lib/remix-export-service'

const ExportSchema = z.object({
  format: z.enum(['png', 'jpeg']).optional().default('png'),
  quality: z.number().min(0.1).max(1).optional().default(0.95),
  width: z.number().min(100).max(2000).optional(),
  height: z.number().min(100).max(2000).optional(),
})

export async function POST(
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
    const validation = ExportSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const options = validation.data

    console.log(`📦 [API] Starting export for remix: ${remixId}`)
    console.log(`📦 [API] Export options:`, options)

    // Generate the ZIP file
    const zipBuffer = await remixExportService.exportRemixAsZip(remixId, options)

    console.log(`✅ [API] Export completed: ${zipBuffer.length} bytes`)

    // Set appropriate headers for file download
    const headers = new Headers()
    headers.set('Content-Type', 'application/zip')
    headers.set('Content-Disposition', `attachment; filename="remix-${remixId}-export.zip"`)
    headers.set('Content-Length', zipBuffer.length.toString())

    return new NextResponse(zipBuffer, { headers })

  } catch (error) {
    console.error(`❌ [API] Export failed for remix ${params.id}:`, error)

    return NextResponse.json(
      {
        error: 'Export failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}