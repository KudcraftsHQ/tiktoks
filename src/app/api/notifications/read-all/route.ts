import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/notification-service'

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const result = await notificationService.markAllAsRead()

    return NextResponse.json({
      success: true,
      updatedCount: result.count
    })
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}
