# File Reference - All Paths

## Core Services

### OCR Service
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/ocr-service.ts`
- **Exports**: `performOCRForTikTokPost()`, `performBatchOCRForTikTokPosts()`
- **Dependencies**: Gemini AI, CacheAssetService, Sentry, Prisma

### Bulk Upsert Service
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/tiktok-bulk-upsert-service.ts`
- **Class**: `TikTokBulkUpsertService`
- **Method**: `bulkUpsert(profileData, postsData, options)`
- **Dependencies**: MediaCacheServiceV2, Prisma

### TikTok Scraping
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/tiktok-scraping.ts`
- **Functions**: `scrapeProfileVideos(handle, cursor, includeProfile)`
- **Uses**: ScrapeCreators API

## Queue System

### Queue Configuration
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/config.ts`
- **Exports**: 
  - `QUEUE_NAMES` constant
  - `getDefaultQueueOptions()`, `defaultQueueOptions`
  - `getDefaultWorkerOptions()`, `defaultWorkerOptions`
  - Job data interfaces

### Media Cache Queue
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/media-cache-queue.ts`
- **Class**: `MediaCacheQueue`
- **Singleton**: `mediaCacheQueue`
- **Methods**: `addCacheJob()`, `addBulkCacheJobs()`, `getStats()`, `clearQueue()`, `close()`

### Media Cache Worker
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/media-cache-worker.ts`
- **Class**: `MediaCacheWorker`
- **Singleton**: `mediaCacheWorker`
- **Process**: Download → Detect → Convert HEIC → Upload to R2 → Update DB

### Profile Monitor Queue
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/profile-monitor-queue.ts`
- **Class**: `ProfileMonitorQueue`
- **Singleton**: `profileMonitorQueue`
- **Methods**: `addMonitorJob()`, `addBulkMonitorJobs()`, `getStats()`, `clearQueue()`, `close()`

### Profile Monitor Worker
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/profile-monitor-worker.ts`
- **Class**: `ProfileMonitorWorker`
- **Singleton**: `profileMonitorWorker`
- **Process**: Scrape → Save Metrics → Bulk Upsert → Update Profile

### Worker Process Entry
- **File**: `/Users/hammashamzah/Projects/carousel-master/worker.ts`
- **Executable**: `pnpm run worker`
- **Env**: `QUEUE_NAME=all|media-cache|profile-monitor`

## API Routes

### Profile Management
- **Add Profile**: `/Users/hammashamzah/Projects/carousel-master/src/app/api/tiktok/profiles/add/route.ts`
  - Method: POST
  - Body: `{ handle, isOwnProfile? }`

- **Monitoring Status**: `/Users/hammashamzah/Projects/carousel-master/src/app/api/tiktok/profiles/[id]/monitoring/route.ts`
  - Method: GET - Fetch status and logs
  - Method: PATCH - Enable/disable monitoring

- **Monitoring Trigger**: `/Users/hammashamzah/Projects/carousel-master/src/app/api/tiktok/profiles/[id]/monitoring/trigger/route.ts`
  - Method: POST - Manually trigger monitoring
  - Body: `{ forceRecache? }`

- **Bulk Monitoring**: `/Users/hammashamzah/Projects/carousel-master/src/app/api/tiktok/profiles/bulk/monitoring/route.ts`
  - Method: PATCH - Bulk enable/disable
  - Body: `{ profileIds, enabled }`

### OCR Processing
- **Single Post OCR**: `/Users/hammashamzah/Projects/carousel-master/src/app/api/tiktok/posts/[id]/ocr/route.ts`
  - Method: POST
  - Calls: `performOCRForTikTokPost()`

- **Bulk OCR**: `/Users/hammashamzah/Projects/carousel-master/src/app/api/tiktok/posts/bulk-ocr/route.ts`
  - Method: POST
  - Body: `{ postIds: string[] }` (1-50 posts)
  - Calls: `performBatchOCRForTikTokPosts()`

## Database Schema

- **File**: `/Users/hammashamzah/Projects/carousel-master/prisma/schema.prisma`
- **Generated Client**: `/Users/hammashamzah/Projects/carousel-master/src/generated/prisma`

### Key Models
1. `TiktokProfile` - Profile with monitoring fields
2. `TiktokPost` - Post with OCR fields, media IDs, categories
3. `PostCategory` - Categories created by AI classification
4. `CacheAsset` - Media asset with R2 cache status
5. `ProfileMonitoringLog` - Log entries for monitoring runs

## Sentry Integration

- **Worker Sentry**: `/Users/hammashamzah/Projects/carousel-master/src/lib/sentry-worker.ts`
  - Functions: `initSentryWorker()`, `setJobContext()`, `captureJobError()`, `captureHeicConversionError()`, `setupQueueSentryListeners()`, `flushSentry()`

## Helper Services

### Media Cache Service V2
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/media-cache-service-v2.ts`
- **Functions**: `cacheImage()`, `cacheVideo()`, `cacheAvatar()`, `cacheTikTokPostMedia()`

### Cache Asset Service
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/cache-asset-service.ts`
- **Function**: `getUrl(cacheAssetId)` - Returns presigned URL or fallback URL

### File Type Detection
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/file-type-detector.ts`
- **Functions**: `analyzeFileBuffer()`, `getFileAnalysisSummary()`

### Media Download Service
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/media-download.ts`
- **Function**: `download(url, options)` - Download with retries

### R2 Upload
- **File**: `/Users/hammashamzah/Projects/carousel-master/src/lib/r2.ts`
- **Function**: `uploadToR2(buffer, folder, filename, contentType)`

## Related Models (Not Core)

- **RemixPost**: `/Users/hammashamzah/Projects/carousel-master/prisma/schema.prisma`
- **DraftSession**: For grouping generated content
- **Asset & AssetFolder**: Global asset management
- **TikTokUploadAccount**: OAuth-connected TikTok accounts

