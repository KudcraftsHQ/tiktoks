# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for creating and editing TikTok-inspired carousels. The app uses Prisma with PostgreSQL for data storage and features drag-and-drop functionality with DnD Kit.

## Development Commands

### Core Development
- **Start development server**: `pnpm dev` (with Turbopack)
- **Build for production**: `pnpm build` (uses Turbopack)
- **Start production server**: `pnpm start`
- **Run linting**: `pnpm lint`

### Testing
- **Run build tests**: `__NEXT_TEST_MODE=1 pnpm run build`

### Database
- **Generate Prisma client**: `pnpm prisma generate`
- **Run migrations**: `pnpm prisma migrate dev`
- **Reset database**: `pnpm prisma migrate reset`
- **View database in browser**: `pnpm prisma studio`

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Tailwind CSS v4 with Shadcn/ui components
- **Drag & Drop**: @dnd-kit for carousel editor
- **TypeScript**: Full TypeScript implementation
- **Package Manager**: pnpm

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── carousel/          # Carousel pages with dynamic routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable React components
├── generated/prisma/      # Auto-generated Prisma client
├── hooks/                 # Custom React hooks
└── lib/                   # Utility functions and configurations
```

### Database Schema
The application uses a relational schema with these main entities:
- **Carousel**: Main entity for TikTok content (metadata, engagement metrics)
- **CarouselVariation**: Different versions/variations of a carousel
- **CarouselSlide**: Individual slides within variations
- **CarouselTextBox**: Text elements on slides with positioning/styling
- **CarouselImage**: Images extracted from TikTok content
- **TikTokProfile**: User profiles from TikTok with metadata and metrics
- **TikTokPost**: Individual TikTok posts with media assets and engagement data
- **CacheAsset**: Centralized asset caching system with R2 storage integration

### Component System
- Uses Shadcn/ui with "new-york" style
- Components aliased as `@/components/ui/*`
- Utility functions at `@/lib/utils`
- Custom hooks in `@/hooks/*`

### Key Features
- TikTok URL parsing and content extraction
- Carousel editor with drag-and-drop slide reordering
- Text box positioning and styling
- Multiple carousel variations per original TikTok
- OCR text extraction from images

## API Integration
- **TikTok Scraping**: Uses ScrapeCreators API with `SCRAPECREATORS_API_KEY` environment variable
- **Content Extraction**: Automatically extracts carousel images, metadata, engagement metrics
- **OCR Service**: Google's Gemini AI for extracting text from images (`GEMINI_API_KEY`)
- **Zod Validation**: Strict API response validation with error handling

## Key Architectural Patterns
- **Prisma Client**: Generated client at `src/generated/prisma/` (not default location)
- **Relational Design**: Carousel → CarouselVariation → CarouselSlide → CarouselTextBox hierarchy
- **DnD Kit**: Sortable slides and draggable text boxes with positioning
- **Canvas Rendering**: Server-side image generation with `@napi-rs/canvas`
- **Transaction Safety**: Database operations wrapped in Prisma transactions

## Asset Handling System

The application uses a centralized asset caching system with R2 storage integration for optimal performance and reliability.

### Architecture Pattern
- **Writing**: Store only CacheAsset IDs in entity tables, original URLs stored in CacheAsset table
- **Reading**: Query CacheAsset by ID → generate presigned URLs from `cacheKey` → fallback to `originalUrl`
- **Background Processing**: Media caching handled asynchronously using BullMQ queue system

### Field Naming Convention
All asset references use consistent `*Id` suffix pointing to CacheAsset entries:
- `avatarId` - Profile/author avatar CacheAsset ID
- `videoId` - Video file CacheAsset ID
- `coverId` - Thumbnail/cover image CacheAsset ID
- `musicId` - Audio track CacheAsset ID
- `imageId` - General image CacheAsset ID
- `backgroundImageId` - Slide background image CacheAsset ID

### Core Services

#### CacheAssetService (`@/lib/cache-asset-service`)
Main service for asset URL resolution:
```typescript
// Get presigned URL from CacheAsset ID
const imageUrl = await cacheAssetService.getUrl(imageId)

// Bulk URL resolution for multiple assets
const imageUrls = await cacheAssetService.getUrls(imageIds)
```

#### MediaCacheServiceV2 (`@/lib/media-cache-service-v2`)
Service for creating cache assets (returns CacheAsset IDs):
```typescript
// Cache single asset and get CacheAsset ID
const cacheAssetId = await mediaCacheServiceV2.cacheImage(originalUrl)

// Cache TikTok post media (videos, covers, music, images, avatars)
const result = await mediaCacheServiceV2.cacheTikTokPostMedia(...)
```

### API Data Flow

#### Writing Data (POST/PUT Operations)
1. Extract media URLs from request data
2. Create CacheAsset entries using MediaCacheServiceV2
3. Store returned CacheAsset IDs in entity fields
4. Background workers download and cache assets to R2

#### Reading Data (GET Operations)
1. Fetch entities with CacheAsset ID references
2. Resolve presigned URLs using CacheAssetService.getUrl()
3. Return resolved URLs to client
4. URLs are either presigned R2 URLs (if cached) or original URLs (fallback)

### Queue System
Background media processing using BullMQ:
- **Media Cache Queue**: Handles asset downloading and R2 uploads
- **Worker Process**: `pnpm run worker` - processes cache jobs
- **Redis**: Queue state management and job persistence

## Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SCRAPECREATORS_API_KEY`: For TikTok content scraping
- `GEMINI_API_KEY`: For AI-powered OCR and content generation
- `R2_ACCOUNT_ID`: Cloudflare R2 account identifier
- `R2_ACCESS_KEY_ID`: R2 access key for authentication
- `R2_SECRET_ACCESS_KEY`: R2 secret key for authentication
- `R2_BUCKET_NAME`: R2 bucket name for asset storage
- `REDIS_URL`: Redis connection string for queue management

## Important Notes
- **Package Manager**: Always use `pnpm` (not npm/yarn)
- **Custom Prisma Location**: Client generated at `src/generated/prisma/` instead of `node_modules`
- **Import Pattern**: Use `@/generated/prisma` for database imports
- **Turbopack**: Enabled for both dev and build processes for faster compilation
- **Asset Pattern**: Always use CacheAssetService for URL resolution in API endpoints
- **Background Workers**: Run `pnpm run worker` for media processing in development
- memorize how you setup next js to have different path for build on dev environment