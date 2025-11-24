# Carousel Master

A Next.js 15 application for creating, remixing, and managing TikTok carousel content. Scrapes TikTok profiles, extracts content patterns using AI, and helps create new carousel content based on proven viral patterns.

## Quick Start

```bash
# Install dependencies
bun install

# Setup database
bun prisma generate
bun prisma migrate dev

# Start development server
bun dev

# Start background workers (separate terminal)
bun run worker
```

## Tech Stack

- **Framework**: Next.js 15 with App Router & Turbopack
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Tailwind CSS v4 + Shadcn/ui
- **Runtime**: Bun
- **AI**: Google Gemini for OCR & content generation
- **Storage**: Cloudflare R2
- **Queue**: BullMQ with Redis

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed project documentation.

### Feature Notes (`notes/`)

| Topic | File |
|-------|------|
| Add a TikTok profile | [ADD_PROFILE_FEATURE.md](./notes/ADD_PROFILE_FEATURE.md) |
| Edit carousel slides | [SLIDE_EDITOR_GUIDE.md](./notes/SLIDE_EDITOR_GUIDE.md) |
| Profile monitoring | [MONITORING_FEATURE.md](./notes/MONITORING_FEATURE.md) |
| Content analysis AI | [CONTENT_ANALYSIS_FEATURE.md](./notes/CONTENT_ANALYSIS_FEATURE.md) |
| Background workers | [BACKGROUND_PROCESSING.md](./notes/BACKGROUND_PROCESSING.md) |
| Docker deployment | [DOCKER_OPTIMIZATION.md](./notes/DOCKER_OPTIMIZATION.md) |
| Bun configuration | [BUN_GUIDE.md](./notes/BUN_GUIDE.md) |
| Error tracking | [SENTRY.md](./notes/SENTRY.md) |

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for BullMQ
- `SCRAPECREATORS_API_KEY` - TikTok scraping
- `GEMINI_API_KEY` - AI features
- `R2_*` - Cloudflare R2 storage credentials
