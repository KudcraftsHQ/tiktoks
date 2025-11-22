# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for creating, remixing, and managing TikTok carousel content. The app scrapes TikTok profiles, extracts content patterns using AI, and helps users create new carousel content based on proven viral patterns.

## Development Commands

### Core Development
- **Start development server**: `bun dev` (with Turbopack)
- **Build for production**: `bun run build` (uses Turbopack)
- **Start production server**: `bun start`
- **Run linting**: `bun run lint`

### Testing
- **Quick type check**: `bun run typecheck` (fast, use during development)
- **Full build test**: `__NEXT_TEST_MODE=1 bun run build` (comprehensive, use before commits)

### Database
- **Generate Prisma client**: `bun prisma generate`
- **Run migrations**: `bun prisma migrate dev`
- **Reset database**: `bun prisma migrate reset`
- **View database in browser**: `bun prisma studio`

### Background Workers
- **Run worker process**: `bun run worker` (processes media caching queue)

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Tailwind CSS v4 with Shadcn/ui components
- **Drag & Drop**: @dnd-kit for carousel editor
- **TypeScript**: Full TypeScript implementation
- **Package Manager**: Bun
- **Runtime**: Bun (native TypeScript support)
- **AI**: Google Gemini for OCR, content generation, and concept extraction

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── concepts/          # Concept Bank page
│   ├── posts/             # Posts explorer
│   ├── remix/             # Remix editor pages
│   ├── projects/          # Project management
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page (Posts table)
├── components/            # Reusable React components
├── generated/prisma/      # Auto-generated Prisma client
├── hooks/                 # Custom React hooks
└── lib/                   # Utility functions, services, and configurations
```

### Database Schema
The application uses a relational schema with these main entities:

#### TikTok Content System
- **TiktokProfile**: Scraped TikTok user profiles with metrics and monitoring settings
- **TiktokPost**: Individual posts with media assets, engagement data, and OCR results
- **PostCategory**: AI-generated categories for post classification
- **TikTokPostMetricsHistory**: Historical engagement metrics for tracking growth

#### Remix System
- **RemixPost**: User-created content remixes with JSON-based slide structure
- **RemixTextStyle**: Reusable text styling templates for remix slides
- **DraftSession**: Groups related draft remixes with generation configuration
- **ProductContext**: Product information for AI-powered content generation

#### Concept Bank System
- **ConceptBank**: Reusable content patterns (HOOK/CONTENT/CTA types)
- **ConceptExample**: Specific copy variations that express a concept
- Types: `HOOK` (opening slides), `CONTENT` (body lessons), `CTA` (closing slides)

#### Content Classification
- **ContentIdeaCategory**: Categories for slide classification by type
- **SlideClassificationIndex**: Searchable index of classified slides

#### Project Organization
- **Project**: Organizes posts and remixes into collections
- **ProjectPost**: Many-to-many relationship between projects and posts

#### Supporting Systems
- **CacheAsset**: Centralized asset caching with R2 storage integration
- **Asset/AssetFolder**: Global asset management for images
- **Conversation**: AI chat conversations with token tracking
- **Notification**: Event tracking and alerts
- **ProfileMonitoringLog**: Profile scraping execution logs
- **TiktokUploadAccount**: OAuth-connected TikTok accounts for uploading

### Component System
- Uses Shadcn/ui with "new-york" style
- Components aliased as `@/components/ui/*`
- Utility functions at `@/lib/utils`
- Custom hooks in `@/hooks/*`

### Key Features
- TikTok profile monitoring and post scraping
- OCR text extraction with slide classification
- Concept Bank for pattern extraction and reuse
- AI-powered content generation (remix, paraphrase, multi-post)
- Drag-and-drop carousel editor
- Project-based content organization
- TikTok OAuth integration for direct posting

## API Integration
- **TikTok Scraping**: Uses ScrapeCreators API with `SCRAPECREATORS_API_KEY` environment variable
- **Content Extraction**: Automatically extracts carousel images, metadata, engagement metrics
- **OCR Service**: Google Gemini AI for text extraction, classification, and content generation (`GEMINI_API_KEY`)
- **Concept Extraction**: AI analyzes slides to identify reusable content patterns
- **Zod Validation**: Strict API response validation with error handling

## Key Architectural Patterns
- **Prisma Client**: Generated client at `src/generated/prisma/` (not default location)
- **JSON Slide Structure**: RemixPost stores slides as JSON with canvas, backgrounds, and text boxes
- **DnD Kit**: Sortable slides and draggable text boxes with positioning
- **Canvas Rendering**: Server-side image generation with `@napi-rs/canvas`
- **Transaction Safety**: Database operations wrapped in Prisma transactions
- **Optimistic UI Updates**: Inline editing components with blur-to-save pattern

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
- **Worker Process**: `bun run worker` - processes cache jobs
- **Redis**: Queue state management and job persistence

## Concept Bank System

The Concept Bank is a pattern library for viral content creation, organizing reusable content patterns by type.

### Structure
- **ConceptBank**: Main entity with title, coreMessage, and type (HOOK/CONTENT/CTA)
- **ConceptExample**: Actual copy variations that express a concept
- **Types**:
  - `HOOK` - Opening slide patterns (attention grabbers)
  - `CONTENT` - Body slide lessons (main value)
  - `CTA` - Closing slide patterns (calls to action)

### Key Patterns
- Examples can be extracted from TikTok posts (sourceType: 'SLIDE') or manually added (sourceType: 'MANUAL')
- Only manual examples can be edited inline
- Concepts are sorted by type: HOOK → CONTENT → CTA
- Examples within concepts are sorted by source post view count (highest first)

### API Endpoints
- `GET /api/concepts` - List concepts with filtering and search
- `POST /api/concepts` - Create new concept
- `PATCH /api/concepts/[id]` - Update concept fields
- `DELETE /api/concepts/[id]` - Delete concept
- `POST /api/concepts/[id]/examples` - Add example to concept
- `PATCH /api/concepts/[id]/examples` - Update manual example
- `POST /api/concepts/extract` - AI-extract concepts from posts

## Key Services

### Content Generation (`@/lib/content-generation-service`)
AI-powered content generation for remixes:
```typescript
// Generate content for a remix
const result = await generateRemixContent(sourcePost, options)
```

### Concept Extraction (`@/lib/concept-extraction-service`)
Extract reusable patterns from TikTok posts:
```typescript
// Extract concepts from classified posts
const result = await extractConceptsFromPosts(postIds)
```

### OCR Service (`@/lib/ocr-service`)
Extract text and classify slides from images:
```typescript
// Process images for OCR and classification
const result = await processImagesWithOCR(imageUrls)
```

## Environment Variables Required
- `DATABASE_URL`: PostgreSQL direct connection string
- `DATABASE_URL_POOLING`: PostgreSQL pooled connection string (for Prisma)
- `SCRAPECREATORS_API_KEY`: For TikTok content scraping
- `GEMINI_API_KEY`: For AI-powered OCR, classification, and content generation
- `R2_ACCOUNT_ID`: Cloudflare R2 account identifier
- `R2_ACCESS_KEY_ID`: R2 access key for authentication
- `R2_SECRET_ACCESS_KEY`: R2 secret key for authentication
- `R2_BUCKET_NAME`: R2 bucket name for asset storage
- `REDIS_URL`: Redis connection string for queue management

## Important Notes
- **Package Manager**: Always use `bun` (not npm/yarn/pnpm)
- **Runtime**: Bun has native TypeScript support - no need for tsx or ts-node
- **Custom Prisma Location**: Client generated at `src/generated/prisma/` instead of `node_modules`
- **Import Pattern**: Use `@/generated/prisma` for database imports
- **Turbopack**: Enabled for both dev and build processes for faster compilation
- **Asset Pattern**: Always use CacheAssetService for URL resolution in API endpoints
- **Background Workers**: Run `bun run worker` for media processing in development
- **Docker**: Uses `imbios/bun-node` for builds (Prisma compatibility) and `oven/bun` for runtime
- **Inline Editing**: Use `InlineEditableTitle` and `InlineEditableText` components for optimistic updates

## UI Component Patterns

### Inline Editing
Components for blur-to-save editing without page reloads:
- `InlineEditableTitle` - Single line text editing
- `InlineEditableText` - Multi-line text editing with textarea
- Pattern: Click to edit → modify → blur to save → optimistic update

### Table Components
- `DataTable` - Generic data table with sorting, pagination, selection
- `PostsTable` - TikTok posts display with image gallery
- `ConceptsTable` - Concept bank with inline editing and examples
- `ProjectPostsTable` - Project-specific posts with slide previews

### Common UI Patterns
- Loading skeletons that match table structure
- Toast notifications via `sonner`
- Image gallery with navigation
- Type badges with consistent colors (HOOK=blue, CONTENT=green, CTA=orange)