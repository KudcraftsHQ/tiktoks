# Quick Reference Guide

## System Architecture at a Glance

This project has two main background processing pipelines:

1. **Media Cache Pipeline**: Downloads media assets and caches them to R2 storage
2. **Profile Monitor Pipeline**: Scrapes TikTok profiles and upserts posts to the database

Plus one synchronous service:
3. **OCR Service**: Analyzes carousel images with Gemini AI for text and classification

---

## Starting the Worker

```bash
# Start all workers
pnpm run worker

# Start specific worker
QUEUE_NAME=media-cache pnpm run worker
QUEUE_NAME=profile-monitor pnpm run worker
```

Redis must be running. Default connection: `redis://localhost:6379`

---

## The Three Flows

### Flow 1: Add a Profile Manually
```
POST /api/tiktok/profiles/add
  {"handle": "@username", "isOwnProfile": false}
    ↓
- Scrapes first page of posts
- Creates/updates profile
- Creates new posts in DB
- Queues media caching jobs
- Returns stats
```

### Flow 2: Monitor Profile Automatically
```
1. Enable monitoring:
   PATCH /api/tiktok/profiles/[id]/monitoring
   {"enabled": true}

2. Manually trigger (or happens automatically):
   POST /api/tiktok/profiles/[id]/monitoring/trigger
   {"forceRecache": false}

3. Worker processes job:
   - Scrapes all pages
   - Saves metrics history
   - Upserts posts and profile
   - Queues media jobs
   - Sets next run to now + 24h
```

### Flow 3: Process OCR for Posts
```
Single post:
  POST /api/tiktok/posts/[id]/ocr

Bulk (1-50 posts):
  POST /api/tiktok/posts/bulk-ocr
  {"postIds": ["id1", "id2", "id3"]}

Result: Creates PostCategory if new, stores OCR data in denormalized fields
```

---

## Key Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `tiktok_profiles` | TikTok users | handle, monitoringEnabled, lastMonitoringRun |
| `tiktok_posts` | TikTok posts | tiktokId, contentType, ocrStatus, postCategoryId |
| `cache_assets` | Media cache entries | originalUrl, cacheKey (R2), status (PENDING/CACHED/FAILED) |
| `post_categories` | AI-generated categories | name, postCount, aiGenerated |
| `profile_monitoring_logs` | Execution logs | profileId, status, postsScraped |

---

## Media Caching Pipeline

```
API Route / Worker
    ↓
MediaCacheServiceV2.cache*() → Creates CacheAsset record
    ↓
MediaCacheQueue.addCacheJob() → Queues async job
    ↓
Redis Queue
    ↓
MediaCacheWorker.processJob()
  1. Download media
  2. Detect file format (magic bytes)
  3. Convert HEIC to JPEG if needed
  4. Upload to R2
  5. Update CacheAsset with cacheKey and CACHED status
```

---

## Profile Monitoring Pipeline

```
API: POST /api/tiktok/profiles/[id]/monitoring/trigger
    ↓
ProfileMonitorQueue.addMonitorJob() → Queues with priority 10
    ↓
Redis Queue
    ↓
ProfileMonitorWorker.processJob()
  FOR each page:
    1. scrapeProfileVideos(handle, cursor)
    2. saveMetricsHistory(existingPosts)
    3. bulkUpsert(profileData, postsData, {forceRecache})
       - Caches media for new posts
       - Upserts profile and posts
       - Updates aggregated metrics
  DONE:
    4. Update profile.lastMonitoringRun = now
    5. Update profile.nextMonitoringRun = now + 24h
```

---

## OCR Pipeline

```
POST /api/tiktok/posts/[id]/ocr (or bulk-ocr)
    ↓
performOCRForTikTokPost(postId)
    ↓
1. Load images from CacheAssets via presigned URLs
2. Call Gemini 2.5 Flash with structured schema
3. Process response:
   - Create/find PostCategory
   - Denormalize results to ocrTexts, imageDescriptions, slideClassifications
   - Update post with ocrStatus='completed'
```

---

## Important Concepts

### CacheAsset IDs
When posts are added, media doesn't store original URLs. Instead:
- Media gets cached to R2
- CacheAsset record is created with originalUrl + cacheKey (R2 path)
- Post stores the CacheAsset UUID (e.g., `videoId`, `coverId`, `imageId`)
- On read: `cacheAssetService.getUrl(cacheAssetId)` returns presigned URL or fallback

### Force Recache
In profile monitoring, `forceRecache=true` means:
- All posts (new AND existing) get media recached
- Useful after R2 purge or format changes
- Default is `false` (only new posts)

### Bulk Upsert Intelligence
- Checks existing posts by tiktokId
- New posts: Store full data + media IDs
- Existing posts: Update only metrics, preserve media IDs
- Processes in batches of 5 to avoid timeout

### OCR Output Structure
```json
{
  "postCategory": {
    "category": "string",
    "confidence": 0-1,
    "isNewCategory": boolean
  },
  "slides": [
    {
      "imageIndex": number,
      "slideType": "hook|content|cta",
      "ocrText": "extracted text",
      "imageDescription": "visual description",
      "confidence": 0-1
    }
  ]
}
```

---

## Status Fields

### ocrStatus (TiktokPost)
- `pending` - Not processed
- `processing` - Currently running Gemini API
- `completed` - Successfully analyzed
- `failed` - Error occurred

### CacheAsset.status
- `PENDING` - Created, waiting for worker
- `DOWNLOADING` - Worker downloading file
- `CACHED` - Successfully uploaded to R2
- `FAILED` - Download or upload error

### ProfileMonitoringLog.status
- `pending` - Not started
- `running` - Currently scraping/upserting
- `completed` - Finished successfully
- `failed` - Error occurred

---

## Debugging

### Check Queue Status
```typescript
// Get stats from queue (pseudo-code)
const stats = await mediaCache.getStats()
console.log(stats)
// Output: { waiting: 5, active: 1, completed: 100, failed: 2, delayed: 0 }
```

### Monitor Database
```sql
-- Check pending OCR
SELECT id, tiktokId, ocrStatus FROM tiktok_posts WHERE ocrStatus != 'completed' LIMIT 10;

-- Check cache assets
SELECT id, status, originalUrl FROM cache_assets WHERE status != 'CACHED' LIMIT 10;

-- Check monitoring logs
SELECT profileId, status, error FROM profile_monitoring_logs ORDER BY startedAt DESC LIMIT 10;
```

### Check Logs
- Worker logs go to stdout
- Look for prefixes: [MediaCacheWorker], [ProfileMonitorWorker], [OCR]
- Errors sent to Sentry if configured

---

## Common Tasks

### Add a New Profile
```bash
curl -X POST http://localhost:3000/api/tiktok/profiles/add \
  -H "Content-Type: application/json" \
  -d '{"handle":"@username","isOwnProfile":false}'
```

### Enable Monitoring
```bash
curl -X PATCH http://localhost:3000/api/tiktok/profiles/[id]/monitoring \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

### Manually Trigger Monitoring
```bash
curl -X POST http://localhost:3000/api/tiktok/profiles/[id]/monitoring/trigger \
  -H "Content-Type: application/json" \
  -d '{"forceRecache":false}'
```

### Process OCR for Single Post
```bash
curl -X POST http://localhost:3000/api/tiktok/posts/[id]/ocr
```

### Bulk OCR (Up to 50 Posts)
```bash
curl -X POST http://localhost:3000/api/tiktok/posts/bulk-ocr \
  -H "Content-Type: application/json" \
  -d '{"postIds":["id1","id2","id3"]}'
```

---

## Environment Setup Checklist

- [ ] PostgreSQL running with DATABASE_URL set
- [ ] Redis running with REDIS_URL set
- [ ] ScrapeCreators API key: SCRAPECREATORS_API_KEY
- [ ] Gemini API key: GEMINI_API_KEY
- [ ] R2 credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
- [ ] R2 URLs: R2_PUBLIC_URL (or R2_CUSTOM_DOMAIN)
- [ ] Optional: Sentry: SENTRY_AUTH_TOKEN

---

## Performance Notes

- Media caching runs with 5 concurrent workers
- Profile scraping: 1 job at a time, paginated with 1s delay between pages
- OCR: Synchronous per post, but batch API accepts up to 50 posts
- All jobs retry 3 times with exponential backoff (2s initial)
- Large transactions split into batches of 5 posts

---

## Related Documentation

- **SYSTEM_OVERVIEW.md** - Detailed architecture and data flows
- **FILE_REFERENCE.md** - All file locations and exports
- **CLAUDE.md** - Project setup and conventions

