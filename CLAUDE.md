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

## Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SCRAPECREATORS_API_KEY`: For TikTok content scraping
- `GEMINI_API_KEY`: For AI-powered OCR and content generation

## Important Notes
- **Package Manager**: Always use `pnpm` (not npm/yarn)
- **Custom Prisma Location**: Client generated at `src/generated/prisma/` instead of `node_modules`
- **Import Pattern**: Use `@/generated/prisma` for database imports
- **Turbopack**: Enabled for both dev and build processes for faster compilation