# Background Processing with Media Caching

This system implements background processing for media downloads and caching using BullMQ and Redis.

## Overview

The system consists of:

1. **CacheAssets Table**: Stores metadata about cached media files
2. **BullMQ Queues**: Background job processing for media downloads
3. **Redis**: Queue storage and job coordination
4. **Background Worker**: Processes media caching jobs

## Architecture Changes

### Database Schema

- **CacheAssets Table**: New table with UUID primary keys, original URLs, cache keys, and status tracking
- **Existing Tables**: Updated to store cache asset IDs in existing `*Key` fields instead of R2 keys
  - `Carousel.authorAvatarKey` → Cache Asset ID
  - `CarouselImage.imageKey` → Cache Asset ID
  - `CarouselSlide.backgroundImageKey` → Cache Asset ID
  - `TiktokProfile.avatarKey` → Cache Asset ID
  - `TiktokPost.videoKey/coverKey/musicKey` → Cache Asset IDs

### Cache Status Flow

```
PENDING → DOWNLOADING → CACHED
       ↓               ↓
       ↓               ↓
       → FAILED ←←←←←←←←←
```

## Setup Instructions

### 1. Install Dependencies

```bash
pnpm install bullmq ioredis uuid
```

### 2. Run Database Migration

```bash
pnpm prisma migrate dev
```

### 3. Start Redis Server

Make sure Redis is running on your system:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using local Redis installation
redis-server
```

### 4. Configure Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration (optional - defaults shown)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Existing R2 variables still required
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket
R2_PUBLIC_URL=your_public_url
```

### 5. Start Background Worker

```bash
# In a separate terminal
pnpm run worker

# For development (auto-restart)
pnpm run worker:dev
```

### 6. Start Your Application

```bash
pnpm dev
```

## Usage

### Creating Cached Media

```typescript
import { mediaCacheServiceV2 } from '@/lib/media-cache-service-v2'

// Cache a single image
const cacheAssetId = await mediaCacheServiceV2.cacheImage('https://example.com/image.jpg')

// Cache multiple images
const cacheAssetIds = await mediaCacheServiceV2.cacheImages([
  'https://example.com/image1.jpg',
  'https://example.com/image2.jpg'
])

// Cache TikTok post media
const result = await mediaCacheServiceV2.cacheTikTokPostMedia(
  'https://video.url',
  'https://cover.url',
  'https://music.url',
  [{ url: 'https://image.url', width: 1080, height: 1920 }],
  'https://avatar.url'
)
```

### Getting URLs

```typescript
import { cacheAssetService } from '@/lib/cache-asset-service'

// Get single URL (works with cache asset IDs or legacy R2 keys)
const url = await cacheAssetService.getUrl(cacheAssetId, originalUrl)

// Get multiple URLs
const urls = await cacheAssetService.getUrls(cacheAssetIds, originalUrls)
```

## How It Works

### 1. Media Queuing

When media needs to be cached:
1. A `CacheAsset` record is created with status `PENDING`
2. A background job is queued with the cache asset ID and original URL
3. The cache asset ID is immediately returned to store in your database

### 2. Background Processing

The worker process:
1. Downloads media from the original URL
2. Updates cache asset status to `DOWNLOADING`
3. Uploads to R2 storage
4. Updates cache asset with `CACHED` status and R2 key
5. Handles failures by setting status to `FAILED`

### 3. URL Resolution

When getting URLs:
1. First checks if the ID is a cache asset ID
2. If cached successfully, returns presigned URL from R2
3. If not cached yet, returns original URL
4. Fallback support for legacy R2 keys

## Benefits

- **No API Timeouts**: Media downloads happen in background
- **Immediate Response**: APIs return instantly with cache asset IDs
- **Retry Logic**: Failed downloads automatically retry 3 times
- **Scalability**: Multiple workers can process jobs concurrently
- **Monitoring**: Queue statistics and job status tracking
- **Backward Compatibility**: Legacy R2 keys still work

## Queue Statistics

Get queue and cache statistics:

```typescript
import { mediaCacheQueue } from '@/lib/queue/media-cache-queue'
import { cacheAssetService } from '@/lib/cache-asset-service'

// Queue stats
const queueStats = await mediaCacheQueue.getStats()
console.log(`Jobs: ${queueStats.waiting} waiting, ${queueStats.active} active`)

// Cache stats
const cacheStats = await cacheAssetService.getStats()
console.log(`Assets: ${cacheStats.cached} cached, ${cacheStats.failed} failed`)
```

## Worker Commands

```bash
# Start worker
pnpm run worker

# Start worker in development mode (auto-restart)
pnpm run worker:dev
```

## Troubleshooting

### Worker Not Processing Jobs

1. Check Redis connection
2. Verify environment variables
3. Check worker logs for errors

### Failed Downloads

```typescript
// Retry failed cache assets
const retryCount = await cacheAssetService.retryFailed()
console.log(`Retried ${retryCount} failed assets`)
```

### Clean Up Old Assets

```typescript
// Clean up cache assets older than 30 days
const deletedCount = await cacheAssetService.cleanup(30)
```