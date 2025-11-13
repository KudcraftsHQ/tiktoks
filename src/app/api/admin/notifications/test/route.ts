import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/notification-service'
import { PrismaClient, NotificationType } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * POST /api/admin/notifications/test
 * Send a test notification to Discord with dummy data
 */
export async function POST(request: NextRequest) {
  try {
    // Create a test notification in the database
    const notification = await notificationService.createNotification({
      type: NotificationType.HIGH_VIEWS,
      title: '🧪 Test Notification',
      message: 'This is a test notification from ViralSense',
      metadata: {
        testMode: true,
        timestamp: new Date().toISOString()
      }
    })

    // Send test notification to Discord
    const discordSuccess = await notificationService.sendToDiscord({
      title: '🧪 Test Notification',
      description: 'This is a test notification to verify your Discord webhook integration is working correctly.',
      color: 0x5865F2, // Discord Blurple color
      fields: [
        {
          name: '👁️ Views',
          value: '1,234',
          inline: true,
        },
        {
          name: '❤️ Likes',
          value: '567',
          inline: true,
        },
        {
          name: '🔄 Shares',
          value: '89',
          inline: true,
        },
        {
          name: '💬 Comments',
          value: '45',
          inline: true,
        },
        {
          name: '📊 Status',
          value: 'Integration Working ✅',
          inline: false,
        },
      ],
      url: 'https://github.com/yourusername/carousel-master',
      timestamp: new Date().toISOString(),
      footer: {
        text: 'ViralSense Test Notification',
      },
    })

    if (!discordSuccess) {
      return NextResponse.json(
        {
          error: 'Discord webhook not configured or failed to send. Check your DISCORD_WEBHOOK_URL environment variable.',
          notificationCreated: true,
          notificationId: notification.id
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully! Check your Discord channel.',
      notificationId: notification.id
    })
  } catch (error) {
    console.error('Failed to send test notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
