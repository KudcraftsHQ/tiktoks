# Bun Migration Guide

This document outlines how this project has been configured to use Bun as the package manager and runtime, covering Next.js with TypeScript and BullMQ workers.

## ✅ Migration Status: COMPLETED

**Migration Date**: November 16, 2025
**Bun Version**: 1.3.1
**Previous Package Manager**: pnpm 9.9.0

This project has been fully migrated from pnpm to Bun.

## Overview

This project uses:
- **Package Manager**: Bun (v1.3.1)
- **Runtime**: Bun (native TypeScript support)
- **Framework**: Next.js 15 (with Turbopack)
- **Language**: TypeScript
- **Task Queue**: BullMQ with Redis
- **Database**: PostgreSQL (with Prisma ORM)
- **Container Runtime**: Docker with hybrid Bun images (imbios/bun-node for build, oven/bun for runtime)

## Package Manager Configuration

### package.json - Bun Setup

```json
{
  "packageManager": "bun@1.1.42"
}
```

The `packageManager` field ensures that Bun v1.1.42 is enforced when running this project. When you try to use npm/pnpm instead, it will error out.

**Note**: tsx dependency has been completely removed as Bun has native TypeScript support.

### Lock File

- **Lock file name**: `bun.lockb` (binary format)
- This file is in .gitignore and should NOT be committed (binary format changes frequently)
- Replaced pnpm's `pnpm-lock.yaml` with Bun's lock file

### Installation

Bun installs packages with a single command:
```bash
bun install
```

This replaces:
```bash
pnpm install  # Old command
npm install   # Old command
```

### Executable Commands

Run scripts with `bun`:
```bash
bun run dev              # Run dev server
bun run build            # Build project
bun run worker:dev       # Run worker in watch mode
bun x [package-name]     # Execute npx-like commands
```

## NPM Scripts Configuration

Key scripts from `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",           // Dev server with Turbopack
    "build": "next build",                   // Production build
    "build:sourcemap": "next build",         // Build with source maps
    "start": "next start",                   // Production server
    "lint": "next lint",                     // ESLint
    "db:migrate": "prisma migrate dev",      // Database migrations
    "db:generate": "prisma generate",        // Generate Prisma client
    "db:studio": "prisma studio",            // Prisma UI
    "db:reset": "prisma migrate reset",      // Reset database
    "worker": "bun src/scripts/start-worker-bun.ts",       // Run worker
    "worker:dev": "bun --watch src/scripts/start-worker-bun.ts",  // Watch mode
    "worker:bun": "bun src/scripts/start-worker-bun.ts",   // Explicit Bun worker
    "worker:bun:dev": "bun --watch src/scripts/start-worker-bun.ts", // Watch mode
    "benchmark": "tsx scripts/worker-memory-benchmark.ts",
    "posthog:sourcemap": "POSTHOG_CLI_TOKEN=$POSTHOG_PERSONAL_API_KEY bun x posthog-cli sourcemap inject..."
  }
}
```

## Next.js Configuration

### next.config.ts

Key configurations for Bun compatibility:

```typescript
const nextConfig: NextConfig = {
  // Different build directories for dev and production
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  // Standalone output for Docker
  output: 'standalone',

  // Production source maps for PostHog
  productionBrowserSourceMaps: true,

  // Turbopack configuration
  turbopack: {
    root: __dirname,
  },
};
```

**Important**: The project uses different build directories:
- **Development**: `.next-dev/` (when `NODE_ENV=development`)
- **Production**: `.next/` (default)

This prevents conflicts when switching between dev and prod builds.

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Worker Configuration with Bun

### BullMQ Workers Setup

The project runs multiple BullMQ workers for background job processing:

**File**: `src/scripts/start-worker-bun.ts`

Key aspects:
1. **Three main workers**:
   - Order Import Worker (`createOrderImportWorker`)
   - Order Detail Enrichment Worker (`createOrderDetailWorker`)
   - COGS Fill Worker (`createCogsWorker`)

2. **Redis Connection** (`src/lib/worker-redis.ts`):
   ```typescript
   // Eager connection for worker processes
   const workerConnection = new IORedis(process.env.REDIS_URL, {
     maxRetriesPerRequest: null,        // Required by BullMQ
     enableReadyCheck: false,
     connectTimeout: 30000,             // Longer timeout for workers
     commandTimeout: 20000,
     offlineQueue: false,
     lazyConnect: false,                // Connect immediately
   });
   ```

3. **Worker Concurrency Settings**:
   - Concurrency: 5 jobs per worker
   - Rate limit: 10 jobs per second
   - Stalled check: 30 seconds
   - Max retries: 5 attempts with exponential backoff

4. **Environment Loading**:
   ```typescript
   import { config } from 'dotenv';
   config({ path: '.env' });
   ```

5. **Graceful Shutdown**:
   - Handles SIGINT and SIGTERM signals
   - Closes all workers gracefully
   - Flushes PostHog events before exit

### Running Workers

With Bun:
```bash
bun run worker           # Run production worker
bun run worker:dev       # Run with --watch for development
bun --watch <file>.ts    # Direct Bun watch mode
```

## Docker Configuration

The project has **two separate Dockerfiles**:

### 1. Main Application Dockerfile (Dockerfile)

The project uses a **multi-stage Docker build** with **hybrid Bun images** for the Next.js application:

```dockerfile
FROM imbios/bun-node:1.3-22-debian AS base  # Build stages use Bun + Node.js for Prisma
FROM oven/bun:1.3-debian AS runner           # Runtime uses pure Bun
```

**Why hybrid approach?**
- Prisma requires Node.js for generation in Docker
- `imbios/bun-node` provides both Bun and Node.js for build compatibility
- `oven/bun` provides lightweight runtime for production

**Build stages**:

1. **base**: Debian-based image with Bun + Node.js, includes libc6, curl, wget, bash, openssl
2. **deps**: Install dependencies with `bun install --frozen-lockfile`
3. **builder**: Build Next.js app with Bun
4. **runner**: Debian-based pure Bun image for runtime

**Key commands in Dockerfile**:
```dockerfile
# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bun run db:generate

# Build Next.js
RUN bun run build:sourcemap

# Runtime command with Prisma migrations
CMD sh -c "bunx prisma migrate deploy && node server.js"
```

**Important Notes**:
- The final CMD uses `node` (not `bun`) because Next.js in standalone mode produces Node.js-compatible output
- Prisma migrations run automatically on container startup
- Build arguments for PostHog source map upload are supported

### 2. Worker Dockerfile (worker.Dockerfile)

Dedicated image for running BullMQ workers:

```dockerfile
FROM oven/bun:alpine AS base
```

**Build stages**:

1. **base**: Alpine with Bun runtime
2. **deps**: Install dependencies and generate Prisma client
3. **runner**: Minimal production image

**Key features**:

```dockerfile
# Install with frozen lockfile
RUN bun install --frozen-lockfile

# Generate Prisma client directly with bun
RUN bun prisma generate

# Run as non-root user (workeruser)
USER workeruser

# Start worker with bun
CMD ["bun", "run", "worker"]
```

**Worker Configuration**:
- Non-root user: `workeruser` (UID 1001)
- Node group: `nodejs` (GID 1001)
- Environment: `NODE_ENV=production`
- Queue: Configurable via `QUEUE_NAME` env var (defaults to `all`)

**Why separate Dockerfile for workers?**
- Lighter image (no Next.js build artifacts)
- Only copies necessary files: `src/`, `prisma/`, TypeScript config
- Faster deployment iterations
- Better resource isolation in orchestration (Kubernetes, Docker Compose)

### Building Docker Images

**Application image**:
```bash
docker build -t kudtrading-app:latest .

# With PostHog source maps
docker build \
  --build-arg POSTHOG_PERSONAL_API_KEY=$POSTHOG_PERSONAL_API_KEY \
  --build-arg POSTHOG_ENV_ID=$POSTHOG_ENV_ID \
  -t kudtrading-app:latest .
```

**Worker image**:
```bash
docker build -f worker.Dockerfile -t carousel-master-worker:latest .
```

**Implementation Notes**:
- Uses Debian-based images instead of Alpine for better glibc compatibility with @napi-rs/canvas
- Lock file is `bun.lockb` instead of `pnpm-lock.yaml`
- All `pnpm` commands replaced with `bun`
- `bunx prisma migrate deploy` works correctly in the hybrid setup

### Docker Compose Example (for local development)

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kudtrading
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/kudtrading
      REDIS_URL: redis://redis:6379

  worker:
    build:
      context: .
      dockerfile: worker.Dockerfile
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/kudtrading
      REDIS_URL: redis://redis:6379
      QUEUE_NAME: all
```

## Database (Prisma)

### Prisma Configuration

**prisma/schema.prisma**:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  directUrl = env("DATABASE_URL")
  url       = env("DATABASE_URL_POOLING")
}
```

Uses two database URLs:
- `DATABASE_URL`: Direct connection (for migrations)
- `DATABASE_URL_POOLING`: Pooled connection (for app)

### Prisma Commands with Bun

```bash
bun run db:generate    # Generate Prisma client (required before building)
bun run db:migrate     # Run pending migrations
bun run db:reset       # Reset database
bun run db:studio      # Open Prisma Studio UI
```

In Docker, Prisma migrations run automatically:
```dockerfile
CMD sh -c "bunx prisma migrate deploy && node server.js"
```

## Git Ignore for Bun

Add to `.gitignore`:
```
# bun
bun.lock
.test-*-worker.ts
benchmark-*.json
simple-benchmark-*.json
memory-profile-*.json
```

## Environment Configuration

### .env.example

Key environment variables:
```bash
NODE_ENV=development                    # Set to production for builds
REDIS_URL=redis://localhost:6379        # BullMQ Redis connection
DATABASE_URL=postgresql://...           # Direct DB connection
DATABASE_URL_POOLING=postgresql://...   # Pooled DB connection
NEXT_PUBLIC_POSTHOG_KEY=...            # PostHog analytics
POSTHOG_PERSONAL_API_KEY=...           # For source map upload
```

## Build and Deployment

### Local Development

```bash
# Install dependencies
bun install

# Run Next.js dev server with Turbopack
bun run dev

# In another terminal, run workers
bun run worker:dev

# Database setup
bun run db:migrate
bun run db:generate
```

### Production Build

```bash
# Generate Prisma client first
bun run db:generate

# Full build with source maps and PostHog upload
POSTHOG_PERSONAL_API_KEY=$POSTHOG_PERSONAL_API_KEY \
POSTHOG_ENV_ID=$POSTHOG_ENV_ID \
bun run build:sourcemap

# Or standard build without source maps
bun run build
```

### Docker Build & Deployment

**Build and push application image**:
```bash
docker build -t your-registry/kudtrading-app:latest .
docker push your-registry/kudtrading-app:latest
```

**Build and push worker image**:
```bash
docker build -f worker.Dockerfile -t your-registry/kudtrading-worker:latest .
docker push your-registry/kudtrading-worker:latest
```

**Run with Docker Compose**:
```bash
docker-compose up -d
```

**Run individual containers**:
```bash
# Application (with automatic migrations)
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -p 3000:3000 \
  kudtrading-app:latest

# Worker
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e NODE_ENV=production \
  kudtrading-worker:latest
```

## Comparison: pnpm vs Bun

| Feature | pnpm | Bun |
|---------|------|-----|
| Lock file | `pnpm-lock.yaml` | `bun.lock` |
| Install | `pnpm install` | `bun install` |
| Run script | `pnpm run dev` | `bun run dev` |
| Run TypeScript | `tsx file.ts` | `bun file.ts` |
| Watch mode | `--watch` | `--watch` |
| Execute package | `pnpx pkg-name` | `bun x pkg-name` |
| Speed | Faster than npm | Faster than pnpm |
| Lock file size | 233 KB (yaml) | Smaller binary |

## Migration Checklist

When migrating another pnpm project to Bun:

- [ ] Update `package.json` to add `"packageManager": "bun@X.X.X"`
- [ ] Delete `pnpm-lock.yaml` and run `bun install` to generate `bun.lock`
- [ ] Update `.gitignore` to ignore `bun.lock` instead of `pnpm-lock.yaml`
- [ ] Update CI/CD scripts to use `bun` instead of `pnpm`
- [ ] Update Dockerfile base image to `FROM oven/bun:alpine`
- [ ] Update Dockerfile install command: `bun install --frozen-lockfile`
- [ ] Update all NPM scripts using `pnpm run` to `bun run`
- [ ] For TypeScript files: replace `tsx` with `bun`
- [ ] Test all database migrations work with `bunx prisma`
- [ ] Test Docker build and runtime
- [ ] Update development documentation

## Performance Notes

Bun provides:
1. **Faster startup time** - Especially important for workers
2. **Native TypeScript support** - No compilation step needed
3. **Better resource usage** - Lower memory footprint than Node.js
4. **Faster package installation** - Parallel install by default

The worker process shows:
- Initial memory: ~50-60MB
- After worker setup: ~80-100MB
- Periodic monitoring every 30 seconds

## Bun-Specific Features & Gotchas

### Native TypeScript Support

Bun can run TypeScript files directly without compilation:
```bash
bun src/scripts/start-worker-bun.ts
bun --watch src/scripts/start-worker-bun.ts
```

No need for `tsx` or `ts-node` wrappers (though they still work).

### Binary Compatibility

Bun is designed to be a drop-in Node.js replacement:
- Supports CommonJS and ES modules
- Compatible with npm packages
- Can run Node.js modules directly

However, some differences:
- Built-in globals like `Bun.env` exist alongside `process.env`
- File I/O APIs are faster than Node.js
- Some Node.js-specific modules may behave differently

### Environment Variables with Bun

Load .env files with dotenv:
```typescript
import { config } from 'dotenv';
config({ path: '.env' });
```

Or use Bun's built-in support:
```typescript
// Bun automatically loads .env files
console.log(Bun.env.DATABASE_URL);
```

### Worker Process Best Practices with Bun

1. **Always set `lazyConnect: false` for workers**:
   ```typescript
   const redis = new IORedis({
     lazyConnect: false,  // Connect immediately
     maxRetriesPerRequest: null,  // Required by BullMQ
   });
   ```

2. **Handle graceful shutdown**:
   ```typescript
   process.on('SIGINT', async () => {
     await worker.close();
     await redis.quit();
     process.exit(0);
   });
   ```

3. **Monitor memory usage**:
   ```typescript
   function logMemory(label: string) {
     const usage = process.memoryUsage();
     console.log(`${label}: ${Math.round(usage.rss / 1024 / 1024)}MB`);
   }
   ```

### Bun CLI Flags

Useful Bun-specific flags:

| Flag | Purpose |
|------|---------|
| `--watch` | Watch files and restart on changes |
| `--hot` | Hot reload (preserves module state) |
| `--inspect` | Enable debugger |
| `--inspect-brk` | Enable debugger and break at startup |
| `--production` | Run in production mode |

Example:
```bash
bun --watch --inspect src/scripts/start-worker-bun.ts
```

## Common Issues & Solutions

### Issue: `bunx prisma` not found
**Solution**: Use `bun x prisma` instead of `bunx prisma`

### Issue: Worker fails to connect to Redis
**Solution**:
- Ensure `lazyConnect: false` in worker Redis config
- Verify `REDIS_URL` environment variable is set
- Check Redis is accessible: `redis-cli ping`

### Issue: Module not found in Bun
**Solution**:
- Verify `tsconfig.json` paths are correct
- Run `bun install` again to ensure dependencies are linked
- Check that node_modules contains the package

### Issue: Prisma WASM files missing in Docker
**Solution**:
- Copy entire `node_modules` to Docker image
- See Dockerfile lines 52-53 for correct COPY command
- Ensure `bun prisma generate` runs in builder stage

### Issue: TypeScript errors in Bun files
**Solution**:
- Bun still respects `tsconfig.json` - verify it's correct
- Use `// @ts-ignore` for intentional type mismatches
- Ensure type definitions are installed (`@types/node`, etc.)

### Issue: Next.js build uses wrong NODE_ENV
**Solution**:
- Set `NODE_ENV=production` explicitly before building
- The config uses `NODE_ENV` to determine distDir
- Docker sets `NODE_ENV=production` in runner stage

### Issue: Worker exits immediately
**Solution**:
- Check environment variables are loaded (use `dotenv` config)
- Verify Redis connection with: `bun -e "const redis = require('ioredis'); new redis().ping().then(console.log)"`
- Check logs for connection errors

## Kubernetes Deployment (Optional)

If deploying to Kubernetes, here's a reference architecture:

### Application Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kudtrading-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kudtrading-app
  template:
    metadata:
      labels:
        app: kudtrading-app
    spec:
      containers:
      - name: app
        image: your-registry/kudtrading-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Worker Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kudtrading-worker
spec:
  replicas: 3  # Scale workers independently
  selector:
    matchLabels:
      app: kudtrading-worker
  template:
    metadata:
      labels:
        app: kudtrading-worker
    spec:
      containers:
      - name: worker
        image: your-registry/kudtrading-worker:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Why Separate Deployments Matter

- **Application**: Stateless HTTP server, can scale for API requests
- **Worker**: Stateful job processor, scale based on queue depth
- **Independent updates**: Deploy workers without restarting API
- **Resource allocation**: Fine-tune CPU/memory for each role
- **Failure isolation**: Worker crash doesn't affect API availability

## Local Development Workflow

### Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Setup database
bun run db:generate
bun run db:migrate

# 3. Start dev server (Terminal 1)
bun run dev

# 4. Start workers (Terminal 2)
bun run worker:dev

# 5. Monitor in browser
# App: http://localhost:3000
# Prisma Studio: bun run db:studio
```

### Development Commands Cheatsheet

```bash
# Package management
bun install              # Install all dependencies
bun add package-name     # Add new package
bun remove package-name  # Remove package
bun update              # Update all packages

# Database
bun run db:generate     # Generate Prisma client
bun run db:migrate      # Run migrations
bun run db:reset        # Reset database (caution!)
bun run db:studio       # Open Prisma UI

# Development
bun run dev             # Start Next.js dev server
bun run worker:dev      # Start workers with watch
bun run lint            # Run ESLint
bun run build           # Build for production
bun run start           # Start production server

# Debugging
bun --inspect dev       # Dev with debugger
bun --inspect-brk run worker  # Worker with debugger
bun -e "code here"      # Eval JavaScript/TypeScript
```

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Bun API Reference](https://bun.sh/api)
- [Next.js with Turbopack](https://nextjs.org/docs/app/api-reference/turbopack)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [BullMQ Best Practices](https://docs.bullmq.io/guide/best-practices)
- [Prisma Database Guide](https://www.prisma.io/docs/)
- [Docker Bun Image](https://hub.docker.com/r/oven/bun)
- [IORedis Documentation](https://github.com/luin/ioredis)
