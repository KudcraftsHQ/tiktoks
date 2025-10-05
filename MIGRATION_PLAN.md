# Bun Monorepo Migration Plan

**Branch:** `ditch-nextjs`
**Target:** Migrate from Next.js 15 to Bun monorepo with Hono API + Vite React frontend

## Executive Summary

This migration will transform the current Next.js 15 application into a modern Bun monorepo architecture, separating the frontend and backend into distinct packages for better performance, maintainability, and deployment flexibility.

### Current State Analysis

- **Framework**: Next.js 15 with App Router
- **Frontend**: React 19, Tailwind CSS v4, Shadcn/ui, DnD Kit, Konva
- **Backend**: 25+ API routes, Prisma ORM, PostgreSQL, BullMQ queues
- **Infrastructure**: Separate worker process, Docker containers, R2 storage
- **Complex Features**: TikTok scraping, OCR processing, media caching, canvas rendering

### Migration Benefits

✅ **Performance**: Bun's faster runtime for both API and bundling
✅ **Bundle Size**: Vite typically produces smaller bundles than Next.js
✅ **Development Experience**: Faster builds and hot reload
✅ **Simpler Deployment**: Decoupled services can be deployed independently
✅ **Better Separation**: Clear frontend/backend boundaries

## Migration Challenges

### High Complexity Areas
- **API Migration**: 25+ Next.js API routes need conversion to Hono endpoints
- **Next.js Patterns**: NextRequest/NextResponse, middleware, route handlers need adaptation
- **File-based Routing**: Manual route setup required in Hono

### Medium Complexity Areas
- **Frontend Migration**: React components well-structured but need Vite configuration
- **Infrastructure**: Docker configurations, worker process integration
- **Development Workflow**: Package manager migration, monorepo setup

## Phase 1: Foundation Setup (2-3 days)

### 1.1 Initialize Bun Monorepo Structure
```bash
# Create new directory structure
carousel-monorepo/
├── apps/
│   ├── api/           # Hono backend
│   └── web/           # Vite React frontend
├── packages/
│   ├── database/      # Prisma schema & client
│   ├── shared/        # Common utilities & types
│   └── ui/            # Shared UI components
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
└── bun.lockb
```

### 1.2 Configure Workspace
- Set up `bun.json` workspace configuration
- Configure TypeScript project references
- Migrate from pnpm to Bun package manager
- Set up shared dependencies

### 1.3 Extract Core Packages
- Move Prisma schema to `packages/database`
- Extract shared utilities to `packages/shared`
- Create type definitions package
- Set up ESLint and Prettier for monorepo

## Phase 2: Backend Migration (5-7 days)

### 2.1 Hono API Foundation
```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prisma } from '@carousel/database'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))
```

### 2.2 Systematic API Route Migration
**Priority Order:**
1. **Core endpoints** (tiktok/posts, tiktok/profiles)
2. **Asset management** (cache-assets, images/*)
3. **OCR processing** (tiktok/posts/*/ocr)
4. **Collections & management** (collections/*, remixes)
5. **Export functionality** (export/*)

### 2.3 API Migration Patterns
```typescript
// Before (Next.js)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // ...logic
  return NextResponse.json(data)
}

// After (Hono)
app.get('/api/tiktok/posts', async (c) => {
  const query = c.req.query()
  // ...logic
  return c.json(data)
})
```

### 2.4 Middleware Integration
- Authentication/authorization middleware
- Request validation with Zod
- Error handling standardization
- Rate limiting and CORS

### 2.5 Worker Process Integration
- Adapt BullMQ worker for Hono context
- Background job processing
- Queue health monitoring

## Phase 3: Frontend Migration (4-5 days)

### 3.1 Vite React Setup
```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

### 3.2 Component Migration Strategy
- **UI Components**: Most Shadcn/ui components transfer directly
- **Font Loading**: Replace Next.js font optimization with CSS @import
- **Routing**: Implement React Router v6 for client-side routing
- **State Management**: Continue with existing patterns (likely useState/useReducer)

### 3.3 Complex Feature Migration
- **DnD Kit**: Minimal changes required
- **Konva Canvas**: Direct migration possible
- **Image Gallery**: Update API calls to use new backend URLs
- **Infinite Scroll**: Adapt to new API endpoints

### 3.4 API Client Setup
```typescript
// packages/shared/lib/api-client.ts
export const apiClient = {
  get: <T>(url: string, params?: any) =>
    fetch(`/api${url}${params ? `?${new URLSearchParams(params)}` : ''}`)
      .then(res => res.json()) as Promise<T>,

  post: <T>(url: string, data: any) =>
    fetch(`/api${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()) as Promise<T>
}
```

## Phase 4: Infrastructure & Deployment (3-4 days)

### 4.1 Docker Configuration
```dockerfile
# docker/api.Dockerfile
FROM oven/bun:latest AS base
WORKDIR /app

FROM base AS deps
COPY apps/api/package.json apps/api/bun.lockb ./
RUN bun install --frozen-lockfile

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build
EXPOSE 3001
CMD ["bun", "run", "start"]
```

### 4.2 Development Environment
- Docker Compose for local development
- Hot reload configuration for both services
- Database and Redis container setup

### 4.3 Production Deployment
- Separate service deployments
- Environment variable management
- Health checks and monitoring
- CI/CD pipeline updates

## Phase 5: Testing & Migration (2-3 days)

### 5.1 Testing Strategy
- **Unit Tests**: Jest/Vitest for utility functions
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Playwright for critical user flows
- **Performance Testing**: Bundle size and runtime performance

### 5.2 Migration Approach
- **Parallel Development**: Run both systems simultaneously
- **Feature Flags**: Gradual rollout of new features
- **Database Compatibility**: Ensure no breaking changes
- **Rollback Plan**: Quick reversion strategy

### 5.3 Cut-over Strategy
1. Deploy new services alongside existing Next.js app
2. Route percentage of traffic to new architecture
3. Monitor performance and error rates
4. Full migration once stability confirmed
5. Decommission Next.js application

## Risk Assessment & Mitigation

### High Risks
- **API Compatibility**: Ensure identical response formats
- **Performance Regression**: Bundle size and runtime performance
- **Deployment Complexity**: Increased infrastructure complexity

### Mitigation Strategies
- **Comprehensive Testing**: Automated testing at all levels
- **Gradual Migration**: Feature flags and parallel deployment
- **Monitoring**: Enhanced logging and performance monitoring
- **Rollback Plan**: Quick reversion to Next.js if needed

## Success Metrics

### Performance Targets
- **Build Time**: 50% faster than Next.js builds
- **Bundle Size**: 20% smaller JavaScript bundles
- **API Response Time**: 30% faster API responses
- **Development Server**: 2x faster hot reload

### Quality Targets
- **Zero Breaking Changes**: All existing functionality preserved
- **100% Test Coverage**: Critical paths covered
- **Performance Budget**: Bundle size limits enforced
- **Error Rate**: <0.1% API error rate

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Foundation | 2-3 days | Monorepo structure, shared packages |
| Phase 2: Backend | 5-7 days | Hono API with all endpoints |
| Phase 3: Frontend | 4-5 days | Vite React app with all features |
| Phase 4: Infrastructure | 3-4 days | Docker deployment, CI/CD |
| Phase 5: Testing | 2-3 days | Full testing coverage, migration |
| **Total** | **16-22 days** | **Complete migration** |

## Next Steps

1. **Create branch**: `git checkout -b ditch-nextjs`
2. **Setup monorepo**: Initialize Bun workspace structure
3. **Begin Phase 1**: Extract shared packages and configure workspace
4. **Team alignment**: Review architecture with development team
5. **Start migration**: Begin with backend API endpoints

## Dependencies & Considerations

- **Team Skills**: Ensure familiarity with Bun, Hono, and Vite
- **Timeline**: Allow buffer for unexpected challenges
- **Resources**: Dedicated focus required for smooth migration
- **Communication**: Regular progress updates and stakeholder alignment