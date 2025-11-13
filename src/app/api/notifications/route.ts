import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/notification-service'

/**
 * GET /api/notifications
 * Get all notifications (paginated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const result = await notificationService.getNotifications(page, limit)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
