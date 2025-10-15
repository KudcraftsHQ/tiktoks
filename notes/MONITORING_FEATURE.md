# TikTok Profile Monitoring Feature

## Overview
Automated 24-hour monitoring system for TikTok profiles with historical metrics tracking.

## Features
- Toggle monitoring on/off per profile via UI switch
- Manual "Update Now" button to force immediate update
- Automated scraping every 24 hours for enabled profiles
- Historical tracking of post metrics (views, likes, shares, comments, saves)
- Aggregated profile metrics calculated from posts (total views, likes, shares, comments, saves)
- Background job processing with BullMQ
- Monitoring execution logs
- Toast notifications for user feedback

## Architecture

### Database Models

#### TiktokProfile (Updated)
- `monitoringEnabled`: Boolean flag to enable/disable monitoring
- `lastMonitoringRun`: Timestamp of last monitoring execution
- `nextMonitoringRun`: Timestamp for next scheduled monitoring

#### TikTokPostMetricsHistory (New)
Stores historical snapshots of post engagement metrics:
- `postId`: Reference to TiktokPost
- `viewCount`, `likeCount`, `shareCount`, `commentCount`, `saveCount`
- `recordedAt`: Timestamp of the snapshot

#### ProfileMonitoringLog (New)
Tracks monitoring job execution:
- `profileId`: Reference to TiktokProfile
- `status`: 'pending', 'running', 'completed', 'failed'
- `startedAt`, `completedAt`: Execution timestamps
- `postsScraped`, `pagesScraped`: Statistics
- `error`: Error message if failed

### Queue System

#### Profile Monitor Queue (`profile-monitor`)
- Queue name: `profile-monitor`
- Worker: `profile-monitor-worker.ts`
- Job data: `{ profileId: string }`
- Retry policy: 3 attempts with exponential backoff

#### Worker Process
The main worker (`worker.ts`) supports queue selection via `QUEUE_NAME` environment variable:
- `all`: Run all workers (default)
- `media-cache`: Run only media cache worker
- `profile-monitor`: Run only profile monitor worker

### Worker Flow

1. **Job Received**: Profile monitoring job is dequeued
2. **Create Log**: Create ProfileMonitoringLog with status 'running'
3. **Fetch Profile**: Get profile details from database
4. **Scrape All Pages**: Loop through all pages using `scrapeProfileVideos` with pagination
5. **Save Metrics History**: Before upserting, save current metrics to TikTokPostMetricsHistory
6. **Bulk Upsert**: Call `/api/tiktok/posts/bulk` to update posts with new data
7. **Calculate Aggregated Metrics**: Sum up all post metrics for the profile
8. **Update Profile Metrics**: Set totalPosts, totalViews, totalLikes, totalShares, totalComments, totalSaves
9. **Update Log**: Mark ProfileMonitoringLog as 'completed' with statistics
10. **Update Profile**: Set `lastMonitoringRun` and `nextMonitoringRun` (now + 24 hours)

## API Endpoints

### Monitoring Toggle
**PATCH** `/api/tiktok/profiles/[id]/monitoring`
```json
{
  "enabled": true
}
```

**GET** `/api/tiktok/profiles/[id]/monitoring`
Returns monitoring status and recent logs.

### Manual Trigger (Force Update)
**POST** `/api/tiktok/profiles/[id]/monitoring/trigger`
Manually queue a monitoring job for immediate processing (higher priority than scheduled jobs).

### Posts with History
**GET** `/api/tiktok/profiles/[id]/posts?includeHistory=true`
Returns posts with up to 30 most recent metrics history entries per post.

## Frontend

### Profile Detail Page
- **Monitoring Switch**: Toggle monitoring on/off in header actions
- **"Update Now" Button**: Manually trigger monitoring (force update)
- **Activity Icon**: Visual indicator for monitoring feature
- **Aggregated Metrics Display**: Shows total posts, views, likes, shares, comments from all posts
  - Posts: Total number of posts
  - Total Views: Sum of all post views
  - Total Likes: Sum of all post likes
  - Total Shares: Sum of all post shares
  - Total Comments: Sum of all post comments
- **Toast Notifications**:
  - Success when monitoring is enabled/disabled
  - Success when manual update is queued
  - Error notifications for failures

**Note**: Follower/following counts are deprecated and not updated by monitoring. Profile metrics are now based on aggregated post data.

## Deployment (Coolify)

### 1. Worker Container Configuration

#### For Media Cache Worker (Existing)
```dockerfile
Environment Variables:
  QUEUE_NAME=media-cache
  (other env vars...)
```

#### For Profile Monitor Worker (New)
```dockerfile
Environment Variables:
  QUEUE_NAME=profile-monitor
  (other env vars...)
```

#### For All Workers (Alternative)
```dockerfile
Environment Variables:
  QUEUE_NAME=all
  (other env vars...)
```

### 2. Scheduled Task Configuration

**Create a new Coolify Scheduled Task:**

- **Name**: Profile Monitoring Trigger
- **Command**: `pnpm tsx scripts/trigger-monitoring.ts`
- **Frequency**: `0 * * * *` (every hour)
- **Container**: Main application container (has database access)

**How it works:**
1. Script runs hourly via Coolify scheduled task
2. Queries database for profiles where `monitoringEnabled = true` AND `nextMonitoringRun <= now`
3. Enqueues monitoring jobs to `profile-monitor` queue
4. Worker processes jobs in background
5. Each job scrapes all pages, saves metrics history, updates posts

## Usage

### Enable Monitoring for a Profile
1. Navigate to profile detail page: `/profiles/[id]`
2. Toggle the "Monitor" switch in the header
3. Monitoring will automatically run every 24 hours

### Manually Trigger Profile Update
1. Navigate to profile detail page: `/profiles/[id]`
2. Click the "Update Now" button
3. Toast notification confirms the job is queued
4. Worker will process the update shortly (higher priority than scheduled jobs)

### Check Monitoring Status
- View last monitoring run and next scheduled run on profile page
- Check monitoring logs via API: `GET /api/tiktok/profiles/[id]/monitoring`

### View Historical Metrics
- API: `GET /api/tiktok/profiles/[id]/posts?includeHistory=true`
- Returns each post with `metricsHistory` array containing historical snapshots

## Environment Variables

Required for monitoring system:
- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Redis connection for BullMQ
- `SCRAPECREATORS_API_KEY`: TikTok scraping API key
- `NEXT_PUBLIC_APP_URL`: Base URL for internal API calls (worker to API)

## Running Locally

### Start all workers:
```bash
pnpm run worker
# or
QUEUE_NAME=all pnpm tsx worker.ts
```

### Start only profile monitor worker:
```bash
QUEUE_NAME=profile-monitor pnpm tsx worker.ts
```

### Manually trigger monitoring:
```bash
pnpm tsx scripts/trigger-monitoring.ts
```

## Monitoring Queue Stats

Check queue statistics:
```typescript
import { profileMonitorQueue } from '@/lib/queue/profile-monitor-queue'

const stats = await profileMonitorQueue.getStats()
// Returns: { waiting, active, completed, failed, delayed, total }
```

## Error Handling

- Failed jobs are retried 3 times with exponential backoff
- Errors are logged to ProfileMonitoringLog
- Profile's `nextMonitoringRun` is updated even on failure
- Monitoring continues on next scheduled run

## Performance Considerations

- Batch size: 5 posts per transaction (prevents timeout)
- Delay between pages: 1 second (respectful scraping)
- History limit: 30 most recent entries per post
- Queue concurrency: 5 concurrent jobs

## Future Enhancements

- Dashboard for monitoring statistics
- Email notifications on monitoring failures
- Configurable monitoring intervals
- Metrics charts on profile page
- Export historical data to CSV
