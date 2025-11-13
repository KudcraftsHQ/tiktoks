# Documentation Index

This project now has comprehensive documentation covering the OCR, queue, and post management systems.

## Available Documentation Files

### 1. QUICK_REFERENCE.md (7 KB, 308 lines)
**Start here!** Quick overview of the system architecture and how to use it.

Contains:
- System architecture at a glance (3 pipelines)
- How to start the worker
- The three main operational flows
- Key database tables
- Important concepts
- Debugging tips
- Common curl command examples
- Performance notes

**Best for:** Getting started quickly, understanding the three pipelines, testing locally

---

### 2. SYSTEM_OVERVIEW.md (24 KB, 794 lines)
**Deep dive documentation** - Complete architectural analysis and technical specifications.

Contains 15 sections:
1. OCR Service Implementation (detail)
2. Queue System Architecture
3. Media Cache Queue & Worker (detailed flow)
4. Profile Monitor Queue & Worker (detailed flow)
5. Worker Process Entry Point
6. Complete Database Schema
7. API Endpoints Reference (all routes)
8. Bulk Upsert Service Explained
9. Post Addition Flow (3 different flows)
10. OCR Processing Flow
11. Data Flow Diagram
12. Key Integration Points
13. Operational Patterns
14. Environment Variables
15. Summary Table

**Best for:** Understanding the complete system, integration work, troubleshooting complex issues

---

### 3. FILE_REFERENCE.md (5 KB, 134 lines)
**Quick lookup guide** - All file paths and code exports.

Contains:
- Core services with file locations
- Queue system files
- API routes
- Database schema location
- Sentry integration
- Helper services
- Related models

**Best for:** Finding specific files, understanding what each file exports, seeing dependencies

---

### 4. CLAUDE.md (6 KB, 164 lines)
**Project conventions** - Development setup and coding standards.

Contains:
- Project overview
- Development commands
- Architecture info
- Directory structure
- Database schema entities
- Component system
- Key features
- API integration
- Important patterns
- Environment variables

**Best for:** Understanding project conventions, development workflow, deployment

---

## System Architecture Summary

The system has **3 integrated pipelines**:

### Pipeline 1: OCR Service (Synchronous)
```
API: POST /api/tiktok/posts/[id]/ocr (single) or bulk-ocr (1-50 posts)
  ↓
performOCRForTikTokPost()
  ↓
1. Load images from CacheAssets
2. Call Gemini 2.5 Flash with structured schema
3. Create/update PostCategory
4. Store denormalized results
5. Update post with status and OCR data
```

### Pipeline 2: Profile Monitoring (Background)
```
Queue: profile-monitor (BullMQ + Redis)
  ↓
ProfileMonitorWorker.processJob()
  ↓
1. Create monitoring log
2. Loop through all pages:
   - Scrape posts
   - Save metrics history
   - Bulk upsert
   - Queue media jobs
3. Update profile metrics and next run time
```

### Pipeline 3: Media Caching (Background)
```
Queue: media-cache (BullMQ + Redis)
  ↓
MediaCacheWorker.processJob()
  ↓
1. Download media
2. Detect file format
3. Convert HEIC to JPEG if needed
4. Upload to R2
5. Update CacheAsset status
```

## How Posts Get Added

1. **Manual API**: `POST /api/tiktok/profiles/add`
   - Scrapes first page
   - Creates profile + posts
   - Queues media caching

2. **Automated Monitoring**: 
   - Enable: `PATCH /api/tiktok/profiles/[id]/monitoring`
   - Trigger: `POST /api/tiktok/profiles/[id]/monitoring/trigger`
   - Worker scrapes all pages + queues media

## Database Schema (Key Models)

- **TiktokProfile**: User with monitoring settings
- **TiktokPost**: Post with OCR fields and media IDs (CacheAssets)
- **PostCategory**: AI-generated categories
- **CacheAsset**: Media cache with R2 status
- **ProfileMonitoringLog**: Execution logs

## Running the System

```bash
# Start worker
pnpm run worker

# Or specific queue
QUEUE_NAME=media-cache pnpm run worker
QUEUE_NAME=profile-monitor pnpm run worker
```

## Key Concepts

### CacheAsset Pattern
- Original URLs NOT stored in posts
- CacheAsset IDs stored instead (videoId, coverId, etc)
- Centralized R2 cache management

### Force Recache
- `forceRecache=false` (default): Only new posts
- `forceRecache=true`: All posts (useful after R2 purge)

### Bulk Upsert
- Detects new vs existing posts
- New: Store full data + media IDs
- Existing: Update metrics only
- Batches of 5 to avoid timeout

### OCR Output
- Creates PostCategory automatically
- Denormalizes: ocrTexts, imageDescriptions, slideClassifications
- Slide types: hook, content, cta
- Confidence scores

## File Structure

```
carousel-master/
├── DOCUMENTATION_INDEX.md ← You are here
├── QUICK_REFERENCE.md ← Start here
├── SYSTEM_OVERVIEW.md ← Deep dive
├── FILE_REFERENCE.md ← File lookup
├── CLAUDE.md ← Project conventions
│
├── src/
│   ├── lib/
│   │   ├── ocr-service.ts
│   │   ├── tiktok-bulk-upsert-service.ts
│   │   ├── tiktok-scraping.ts
│   │   └── queue/
│   │       ├── config.ts
│   │       ├── media-cache-queue.ts
│   │       ├── media-cache-worker.ts
│   │       ├── profile-monitor-queue.ts
│   │       └── profile-monitor-worker.ts
│   └── app/api/
│       ├── tiktok/profiles/add/route.ts
│       ├── tiktok/profiles/[id]/monitoring/route.ts
│       ├── tiktok/profiles/[id]/monitoring/trigger/route.ts
│       ├── tiktok/posts/[id]/ocr/route.ts
│       └── tiktok/posts/bulk-ocr/route.ts
│
├── prisma/schema.prisma ← Database schema
└── worker.ts ← Worker entry point
```

## Recommended Reading Order

1. **Start with**: QUICK_REFERENCE.md (5-10 minutes)
   - Get high-level understanding of the 3 pipelines
   - See how to run the system

2. **Then**: FILE_REFERENCE.md (5 minutes)
   - Know where everything is located

3. **Deep dive**: SYSTEM_OVERVIEW.md (30+ minutes)
   - Understand each component in detail
   - Review database schema
   - Learn all API endpoints

4. **Reference**: CLAUDE.md
   - Project conventions
   - Development workflow

## Common Tasks

### Add a Profile
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

### Process OCR
```bash
# Single post
curl -X POST http://localhost:3000/api/tiktok/posts/[id]/ocr

# Bulk (1-50 posts)
curl -X POST http://localhost:3000/api/tiktok/posts/bulk-ocr \
  -H "Content-Type: application/json" \
  -d '{"postIds":["id1","id2","id3"]}'
```

## Environment Variables

Required:
- DATABASE_URL, DATABASE_URL_POOLING
- REDIS_URL
- SCRAPECREATORS_API_KEY
- GEMINI_API_KEY
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

See SYSTEM_OVERVIEW.md section 14 for complete list.

## Troubleshooting

### Check queue status
Query `ProfileMonitoringLog` and `CacheAsset` tables in database

### Review worker logs
Worker logs to stdout with prefixes:
- [MediaCacheWorker]
- [ProfileMonitorWorker]
- [OCR]
- [BulkUpsertService]

### Check Sentry
Errors reported to Sentry with context

## Next Steps

1. Start worker: `pnpm run worker`
2. Read QUICK_REFERENCE.md
3. Test the flows with curl commands
4. Monitor logs and database changes
5. Review SYSTEM_OVERVIEW.md for details

---

*Generated: November 12, 2025*
*Comprehensive system documentation for OCR, queue, and post management systems*
