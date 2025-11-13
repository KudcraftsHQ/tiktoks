# Comprehensive System Overview: OCR, Queue, and Post Management

## 1. OCR SERVICE IMPLEMENTATION

### Location
`/Users/hammashamzah/Projects/carousel-master/src/lib/ocr-service.ts`

### Core Functionality
The OCR service performs batch analysis of TikTok carousel posts using Google Gemini AI with structured output.

#### Main Functions

**`performOCRForTikTokPost(postId: string)`**
- Processes a single TikTok post for OCR
- Flow:
  1. Fetches TikTokPost from database (must be `contentType: 'photo'`)
  2. Updates `ocrStatus` to `'processing'`
  3. Loads all carousel images from CacheAssets via presigned URLs
  4. Calls Gemini 2.5 Flash with structured schema
  5. Extracts and classifies:
     - Post-level category (creates new categories if needed)
     - Per-slide analysis: slideType (hook/content/cta), ocrText, imageDescription
  6. Stores results in denormalized format for fast querying
  7. Updates database with `ocrStatus: 'completed'` or `'failed'`

**`performBatchOCRForTikTokPosts(postIds: string[])`**
- Processes multiple posts sequentially with Promise.allSettled
- Returns array of results with success/error status
- Logs summary: `${successCount}/${postIds.length} processed`

### Database Fields Updated
```typescript
ocrData: Json              // Full structured response from Gemini
ocrTexts: Json            // Denormalized: [{"imageIndex": 0, "text": "..."}]
imageDescriptions: Json   // Denormalized: [{"imageIndex": 0, "imageDescription": "..."}]
slideClassifications: Json // Denormalized: [{"slideIndex": 0, "slideType": "hook", ...}]
ocrStatus: String         // 'pending' | 'processing' | 'completed' | 'failed'
ocrProcessedAt: DateTime
postCategoryId: String    // Foreign key to PostCategory
categoryConfidence: Float
classificationStatus: String
classificationProcessedAt: DateTime
```

### Gemini Structured Output Schema
```typescript
{
  postCategory: {
    category: string
    confidence: number (0-1)
    isNewCategory: boolean
  },
  slides: [
    {
      imageIndex: number
      slideType: 'hook' | 'content' | 'cta'
      ocrText: string (overlay text only)
      imageDescription: string
      confidence: number
    }
  ],
  processingMetadata: {
    totalSlides: number
    processedAt: ISO timestamp
    allSlidesProcessed: boolean
  }
}
```

### Error Handling
- Validates GEMINI_API_KEY exists
- Validates post exists and is photo type
- Handles JSON parsing errors
- Captures all errors to Sentry with context
- Updates post status to 'failed' on error

---

## 2. QUEUE SYSTEM (BullMQ + Redis)

### Architecture
Two independent queues for background processing:
1. **Media Cache Queue** - Download and cache media assets to R2
2. **Profile Monitor Queue** - Scrape profiles and upsert posts

### Queue Configuration

**Location:** `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/config.ts`

```typescript
Redis Configuration:
- Connection: REDIS_URL env (default: redis://localhost:6379)
- maxRetriesPerRequest: null (required for BullMQ blocking)
- enableOfflineQueue: true

Queue Options:
- removeOnComplete: 100 jobs (keep last 100)
- removeOnFail: 50 jobs (keep last 50)
- attempts: 3 retries
- backoff: exponential 2000ms

Worker Options:
- concurrency: 5 jobs simultaneously
```

### Queue Names
- `MEDIA_CACHE: 'media-cache'`
- `PROFILE_MONITOR: 'profile-monitor'`

---

## 3. MEDIA CACHE QUEUE & WORKER

### Queue Location
`/Users/hammashamzah/Projects/carousel-master/src/lib/queue/media-cache-queue.ts`

### Job Data
```typescript
interface MediaCacheJobData {
  originalUrl: string
  cacheAssetId: string
  folder?: string          // Default: 'media'
  filename?: string
}

interface MediaCacheJobResult {
  success: boolean
  cacheAssetId: string
  cacheKey?: string        // R2 storage key
  error?: string
  fileSize?: number
  contentType?: string
}
```

### Queue Methods
- `addCacheJob(data, priority)` - Add single job
- `addBulkCacheJobs(jobs, priority)` - Add multiple jobs
- `getStats()` - Return {waiting, active, completed, failed, delayed, total}
- `clearQueue()` - Obliterate all jobs
- `close()` - Gracefully close connection

### Worker Implementation

**Location:** `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/media-cache-worker.ts`

#### Process Flow for Each Job
1. Update CacheAsset status to `DOWNLOADING`
2. Check if URL is already R2 (skip if yes)
3. Download media with retries (2x, 60s timeout)
4. Detect file format using magic bytes
5. Handle HEIC conversion:
   - Only convert if file format matches HEIC magic bytes
   - Convert to JPEG with 92% quality
   - Log format mismatches to Sentry
   - Continue with original buffer if conversion fails
6. Upload to R2 with processed filename
7. Update CacheAsset with status, cacheKey, fileSize, contentType

#### HEIC Conversion Features
- Analyzes buffer to detect actual format (not just URL/mime type)
- Prevents conversion if format is JPEG/PNG (format mismatch warning)
- Captures detailed file analysis to Sentry on errors
- Falls back gracefully to original buffer

#### Status Updates
- `PENDING` → `DOWNLOADING` → `CACHED` (success)
- `PENDING` → `FAILED` (any error)

---

## 4. PROFILE MONITOR QUEUE & WORKER

### Queue Location
`/Users/hammashamzah/Projects/carousel-master/src/lib/queue/profile-monitor-queue.ts`

### Job Data
```typescript
interface ProfileMonitorJobData {
  profileId: string
  forceRecache?: boolean
}

interface ProfileMonitorJobResult {
  success: boolean
  profileId: string
  postsScraped?: number
  pagesScraped?: number
  error?: string
}
```

### Queue Methods
- `addMonitorJob(profileId, priority, {forceRecache})` - Single profile
- `addBulkMonitorJobs(profileIds, priority)` - Multiple profiles
- Unique job IDs with timestamp: `monitor-${profileId}-${Date.now()}`
- `getStats()` - Queue statistics
- `clearQueue()` - Clear all jobs

### Worker Implementation

**Location:** `/Users/hammashamzah/Projects/carousel-master/src/lib/queue/profile-monitor-worker.ts`

#### Process Flow
1. Create ProfileMonitoringLog entry with status='running'
2. Loop through all pages:
   - Call `scrapeProfileVideos(handle, cursor)` from ScrapeCreators API
   - Save metrics history for existing posts (before update)
   - Call `TikTokBulkUpsertService.bulkUpsert()` to:
     - Cache all media assets asynchronously
     - Upsert profile and posts in database
     - Update aggregated metrics
   - Continue with next cursor if hasMore=true
   - Small 1s delay between pages
3. Update ProfileMonitoringLog with:
   - status='completed'
   - postsScraped, pagesScraped counts
4. Update TiktokProfile:
   - lastMonitoringRun = now
   - nextMonitoringRun = now + 24 hours

#### Error Handling
- Logs all errors to ProfileMonitoringLog with status='failed'
- Captures to Sentry with context tags and scope
- Continues gracefully if single page fails

#### Media Caching (via TikTokBulkUpsertService)
- Caches videos, covers, music, images, and author avatars
- Only caches NEW posts unless `forceRecache=true`
- Reuses existing CacheAsset IDs for existing posts

---

## 5. WORKER PROCESS ENTRY POINT

### Location
`/Users/hammashamzah/Projects/carousel-master/worker.ts`

### Usage
```bash
# Process all queues
pnpm run worker

# Process specific queue
QUEUE_NAME=media-cache pnpm run worker
QUEUE_NAME=profile-monitor pnpm run worker
```

### Features
- Initializes Sentry for error tracking
- Dynamically starts workers based on QUEUE_NAME env
- Graceful shutdown on SIGTERM/SIGINT
- Handles uncaught exceptions and unhandled rejections
- Flushes Sentry before shutdown
- Keeps process alive with interval loop

### Active Workers
- `mediaCacheWorker` - Singleton instance from media-cache-worker.ts
- `profileMonitorWorker` - Singleton instance from profile-monitor-worker.ts

---

## 6. DATABASE SCHEMA

### TikTokPost Model (Relevant Fields)

```prisma
model TikTokPost {
  id String @id @default(cuid())
  tiktokId String @unique
  profileId String
  tiktokUrl String @unique
  contentType String  // 'video' or 'photo'
  
  // Media cache asset IDs
  videoId String? @db.Uuid
  coverId String? @db.Uuid
  musicId String? @db.Uuid
  images Json @default("[]")  // [{"cacheAssetId": "uuid", "width": 100, "height": 200}]
  
  // OCR fields
  ocrData Json @default("{}")
  ocrTexts Json @default("[]")
  imageDescriptions Json @default("[]")
  ocrStatus String @default("pending")
  ocrProcessedAt DateTime?
  
  // Category classification
  postCategoryId String?
  categoryConfidence Float?
  slideClassifications Json @default("[]")
  classificationStatus String @default("pending")
  classificationProcessedAt DateTime?
  
  // Metrics
  viewCount BigInt? @default(0)
  likeCount Int? @default(0)
  shareCount Int? @default(0)
  commentCount Int? @default(0)
  saveCount Int? @default(0)
  duration Float?
  publishedAt DateTime?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  profile TiktokProfile @relation(...)
  postCategory PostCategory? @relation(...)
  
  @@index([profileId])
  @@index([contentType])
  @@index([ocrStatus])
  @@index([postCategoryId])
  @@index([publishedAt])
}

model PostCategory {
  id String @id @default(cuid())
  name String @unique
  description String?
  aiGenerated Boolean @default(false)
  postCount Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  posts TiktokPost[]
  
  @@index([name])
  @@index([aiGenerated])
}

model TiktokProfile {
  id String @id @default(cuid())
  handle String @unique
  nickname String?
  avatarId String? @db.Uuid
  bio String?
  verified Boolean @default(false)
  
  // Monitoring fields
  monitoringEnabled Boolean @default(false)
  lastMonitoringRun DateTime?
  nextMonitoringRun DateTime?
  
  // Aggregated metrics
  totalPosts Int @default(0)
  totalViews BigInt @default(0)
  totalLikes BigInt @default(0)
  totalShares BigInt @default(0)
  totalComments BigInt @default(0)
  totalSaves BigInt @default(0)
  
  isOwnProfile Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  posts TiktokPost[]
  monitoringLogs ProfileMonitoringLog[]
  
  @@index([handle])
  @@index([monitoringEnabled, nextMonitoringRun])
  @@index([isOwnProfile])
}

model CacheAsset {
  id String @id @default(uuid()) @db.Uuid
  originalUrl String @unique
  cacheKey String?        // R2 storage key when cached
  status CacheStatus @default(PENDING)  // PENDING | DOWNLOADING | CACHED | FAILED
  fileSize Int?
  contentType String?
  cachedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([status])
  @@index([originalUrl])
}

model ProfileMonitoringLog {
  id String @id @default(cuid())
  profileId String
  status String              // 'pending' | 'running' | 'completed' | 'failed'
  startedAt DateTime @default(now())
  completedAt DateTime?
  postsScraped Int?
  pagesScraped Int?
  error String?
  
  profile TiktokProfile @relation(...)
  
  @@index([profileId, startedAt])
  @@index([status])
}
```

---

## 7. API ENDPOINTS

### Profile Management

**POST /api/tiktok/profiles/add**
- Add a new profile and fetch initial posts
- Body: `{ handle: string, isOwnProfile?: boolean }`
- Calls `scrapeProfileVideos()` to get initial batch
- Returns: profile info and stats
- TODO: Queue background job for remaining posts if hasMore=true

**GET /api/tiktok/profiles/[id]/monitoring**
- Get monitoring status and recent logs
- Returns: monitoringEnabled, lastMonitoringRun, nextMonitoringRun, recentLogs (10 most recent)

**PATCH /api/tiktok/profiles/[id]/monitoring**
- Enable/disable monitoring for a profile
- Body: `{ enabled: boolean }`
- Sets nextMonitoringRun to now + 24h if enabling
- Returns: updated profile with monitoring settings

**POST /api/tiktok/profiles/[id]/monitoring/trigger**
- Manually trigger monitoring job (force update)
- Body: `{ forceRecache?: boolean }` (optional)
- Queues job with priority=10 (higher than automated)
- Options:
  - `forceRecache=true`: Recaches all media assets
  - `forceRecache=false`: Only caches new posts
- Returns: confirmation with profileId

**PATCH /api/tiktok/profiles/bulk/monitoring**
- Bulk enable/disable monitoring for multiple profiles
- Body: `{ profileIds: string[], enabled: boolean }`
- Returns: updatedCount and enabled status

### OCR Processing

**POST /api/tiktok/posts/[id]/ocr**
- Trigger OCR for a single post
- Calls `performOCRForTikTokPost(postId)`
- Returns: success message or error
- Error response includes error details

**POST /api/tiktok/posts/bulk-ocr**
- Batch OCR for multiple posts
- Body: `{ postIds: string[] }` (1-50 posts per batch)
- Calls `performBatchOCRForTikTokPosts(postIds)`
- Returns:
  ```json
  {
    "success": true,
    "summary": { "total": 5, "successful": 4, "failed": 1 },
    "results": [
      { "postId": "...", "success": true/false, "error": "..." }
    ]
  }
  ```

---

## 8. BULK UPSERT SERVICE

### Location
`/Users/hammashamzah/Projects/carousel-master/src/lib/tiktok-bulk-upsert-service.ts`

### Purpose
Reusable service for bulk upserting profiles and posts used by:
- Background worker (ProfileMonitorWorker)
- Initial profile add API route
- Any batch post import

### Key Methods

**`bulkUpsert(profileData, postsData, options)`**
1. **Profile Avatar Caching** (outside transaction)
   - Cache profile avatar if provided
   - Store cacheAssetId
   
2. **Identify New vs Existing Posts**
   - Query existing posts by tiktokId
   - Split into new and existing lists
   
3. **Media Caching Strategy**
   ```
   if forceRecache=true:
     Cache all posts (new + existing)
   else:
     Cache only new posts
     Reuse existing CacheAsset IDs for existing posts
   ```
   
4. **Database Operations**
   - Upsert profile in separate transaction
   - Process posts in batches of 5 (avoid timeout)
   - Create: All fields including media IDs
   - Update: Only metrics and metadata (preserve media IDs)
   
5. **Return Statistics**
   ```typescript
   {
     stats: {
       postsCreated: number
       postsUpdated: number
       totalPosts: number
     },
     profileId: string
   }
   ```

### Data Sanitization
- Removes control characters from strings
- Handles invalid hex/Unicode sequences
- Safe JSON stringification with proper escaping

---

## 9. POST ADDITION FLOW

### Flow 1: Manual Profile Addition via API

```
User: POST /api/tiktok/profiles/add
  ↓
API Route (/add/route.ts)
  ├─ Parse request: { handle, isOwnProfile }
  ├─ Call scrapeProfileVideos(handle, undefined, true)
  ├─ Validate profile data exists
  ├─ Create/update profile with avatar caching
  ├─ Create/update posts from first batch
  ├─ Update profile metrics (aggregates)
  └─ Return: stats + processing=hasMore flag
    ↓
Background (TODO): Queue job for remaining pages if hasMore=true
```

### Flow 2: Automated Profile Monitoring

```
1. Enable Monitoring (API Route)
   ├─ PATCH /api/tiktok/profiles/[id]/monitoring
   ├─ Set monitoringEnabled=true
   ├─ Set nextMonitoringRun = now + 24h
   └─ Return profile status

2. Manual Trigger (API Route)
   ├─ POST /api/tiktok/profiles/[id]/monitoring/trigger
   ├─ Call profileMonitorQueue.addMonitorJob(profileId, priority=10, {forceRecache})
   └─ Return: confirmation

3. Background Worker Processing
   ├─ Worker picks up job from queue
   ├─ Create ProfileMonitoringLog (status='running')
   ├─ Loop: scrapeProfileVideos() for each page
   │  ├─ Save metrics history (before update)
   │  ├─ Call bulkUpsert() to:
   │  │  ├─ Cache media (new posts or all if forceRecache)
   │  │  ├─ Upsert profile and posts
   │  │  └─ Update profile metrics
   │  └─ Continue if hasMore=true (1s delay)
   ├─ Update ProfileMonitoringLog (status='completed')
   ├─ Update TiktokProfile:
   │  ├─ lastMonitoringRun = now
   │  └─ nextMonitoringRun = now + 24h
   └─ Return: results with stats
```

### Flow 3: Direct Post Addition (within bulkUpsert)

```
Media Caching Phase:
  ├─ For each post's media (video, cover, music, images, avatar)
  ├─ Call mediaCacheServiceV2.cache*() functions
  ├─ Get CacheAsset IDs
  ├─ Add jobs to media-cache queue for async download
  └─ Return cached IDs (or null if caching fails)

Database Phase (Transactions):
  ├─ Upsert profile (separate transaction)
  ├─ Process posts in batches of 5:
  │  ├─ For NEW posts:
  │  │  ├─ Store all fields
  │  │  ├─ Store media CacheAsset IDs
  │  │  └─ Create entry
  │  └─ For EXISTING posts:
  │     ├─ Update metrics only
  │     ├─ Preserve existing media IDs
  │     └─ Update entry
  └─ Return: stats
```

---

## 10. OCR PROCESSING FLOW

### Triggering OCR

**Option 1: Single Post**
```
POST /api/tiktok/posts/[id]/ocr
  ↓
Call performOCRForTikTokPost(postId)
  ├─ Validate post exists and contentType='photo'
  ├─ Update ocrStatus='processing'
  ├─ Load images from CacheAssets
  ├─ Call Gemini API
  ├─ Process response
  ├─ Create/update PostCategory
  ├─ Denormalize results
  └─ Update post + return
```

**Option 2: Batch**
```
POST /api/tiktok/posts/bulk-ocr
  ↓
Call performBatchOCRForTikTokPosts(postIds[])
  ├─ Promise.allSettled() for all posts
  ├─ Calls performOCRForTikTokPost() for each
  └─ Returns summary: total/successful/failed
```

### Category Management

During OCR:
1. Fetch existing PostCategories
2. For detected category:
   - If `isNewCategory=true`: Create new PostCategory
   - Else: Find existing by name
   - If not found: Create with warning log
3. Update postCategoryId and increment postCount

---

## 11. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                             │
├──────────────────┬──────────────────────────────────────────┤
│ ScrapeCreators   │ Google Gemini AI    │ Cloudflare R2      │
│ (TikTok scraping)│ (OCR & Classification)│ (Media Storage)  │
└────────┬─────────┴──────────────────────┴──────────────────┘
         │
┌────────┴──────────────────────────────────────────────────────┐
│                   API Routes (Next.js)                        │
├────────────────┬──────────────────┬──────────────────────────┤
│ /add           │ /monitoring      │ /ocr                    │
│ /monitoring/*  │ /bulk/monitoring │ /bulk-ocr               │
└────────┬───────┴────────────┬─────┴────────────────┬─────────┘
         │                    │                      │
    ┌────┴─────────┐    ┌─────┴──────────────┐  ┌──┴────────────┐
    │ Direct DB Op │    │ Queue Management   │  │ Direct Service│
    │   (sync)     │    │   (async)          │  │    (sync)     │
    └────┬─────────┘    └─────┬──────────────┘  └──┴────────────┘
         │                    │                      │
    ┌────┴──────────────────────┴──────────────────┴────────────┐
    │                  BullMQ Queues (Redis)                     │
    ├─────────────────────────┬────────────────────────────────┤
    │ media-cache             │ profile-monitor                │
    │ (download & upload to R2)│ (scrape & upsert)             │
    └─────────────────────────┴────────────────────────────────┘
         │                            │
    ┌────┴─────────────┐         ┌────┴────────────────────┐
    │ MediaCacheWorker │         │ ProfileMonitorWorker    │
    │                  │         │                         │
    │ - Download media │         │ - Scrape videos        │
    │ - Convert HEIC   │         │ - Save metrics history │
    │ - Upload to R2   │         │ - Bulk upsert          │
    │ - Update status  │         │ - Update profile       │
    └────┬─────────────┘         └────┬────────────────────┘
         │                            │
    ┌────┴─────────────────────────────┴────────────────────┐
    │              PostgreSQL Database                       │
    ├──────────────┬──────────────┬──────────────────────────┤
    │ TiktokProfile│ TiktokPost   │ CacheAsset              │
    │ PostCategory │ CacheAsset   │ ProfileMonitoringLog    │
    │ TikTokPostMetricsHistory     │ OCR Results (in JSON)   │
    └─────────────────────────────────────────────────────────┘
```

---

## 12. KEY INTEGRATION POINTS

### MediaCacheServiceV2 Integration
- Used by: TikTokBulkUpsertService, add/route.ts
- Returns: CacheAsset IDs for use in database
- Queues: Media cache jobs asynchronously

### TikTokBulkUpsertService Integration
- Used by: ProfileMonitorWorker, add/route.ts
- Handles: Profile upsert + post creation/update + metrics
- Smart caching: Only new posts unless forceRecache=true

### OCR Service Integration
- Used by: /ocr/route.ts, /bulk-ocr/route.ts
- Creates: PostCategory entries automatically
- Denormalizes: Results for fast query access

---

## 13. OPERATIONAL PATTERNS

### Running Worker Processes
```bash
# All queues
pnpm run worker

# Specific queue
QUEUE_NAME=media-cache pnpm run worker

# With custom Redis
REDIS_URL=redis://custom:6379 pnpm run worker

# Environment vars supported:
# - QUEUE_NAME: all | media-cache | profile-monitor
# - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB
```

### Monitoring Profile Posts
```bash
# 1. Add profile
curl -X POST http://localhost:3000/api/tiktok/profiles/add \
  -H "Content-Type: application/json" \
  -d '{"handle":"@username","isOwnProfile":false}'

# 2. Enable monitoring
curl -X PATCH http://localhost:3000/api/tiktok/profiles/[id]/monitoring \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'

# 3. Manual trigger
curl -X POST http://localhost:3000/api/tiktok/profiles/[id]/monitoring/trigger \
  -H "Content-Type: application/json" \
  -d '{"forceRecache":false}'

# 4. Check status
curl http://localhost:3000/api/tiktok/profiles/[id]/monitoring
```

### Processing OCR
```bash
# Single post
curl -X POST http://localhost:3000/api/tiktok/posts/[id]/ocr

# Bulk (up to 50)
curl -X POST http://localhost:3000/api/tiktok/posts/bulk-ocr \
  -H "Content-Type: application/json" \
  -d '{"postIds":["id1","id2","id3"]}'
```

---

## 14. ENVIRONMENT VARIABLES REQUIRED

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_URL_POOLING=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# TikTok Scraping
SCRAPECREATORS_API_KEY=...

# OCR & AI
GEMINI_API_KEY=...

# R2 Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
R2_CUSTOM_DOMAIN=... (optional)

# Error Tracking
SENTRY_AUTH_TOKEN=...
```

---

## 15. SUMMARY TABLE

| Component | Location | Purpose | Trigger |
|-----------|----------|---------|---------|
| OCR Service | ocr-service.ts | Analyze carousel images with Gemini | API POST /ocr |
| MediaCacheQueue | media-cache-queue.ts | Queue media downloads | bulkUpsert, add/route |
| MediaCacheWorker | media-cache-worker.ts | Download & upload to R2 | Redis worker |
| ProfileMonitorQueue | profile-monitor-queue.ts | Queue profile scraping | Manual trigger, scheduled |
| ProfileMonitorWorker | profile-monitor-worker.ts | Scrape posts & upsert | Redis worker |
| BulkUpsertService | tiktok-bulk-upsert-service.ts | Batch DB operations | Worker & add/route |
| Add Profile API | profiles/add/route.ts | Initial profile import | User action |
| Monitoring Routes | profiles/[id]/monitoring* | Enable/disable/trigger | User action |

