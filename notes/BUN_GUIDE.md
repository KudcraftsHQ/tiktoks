# Bun Configuration Guide

This project uses Bun as the package manager and runtime.

## Overview

- **Package Manager**: Bun (v1.3.1+)
- **Runtime**: Bun (native TypeScript support)
- **Framework**: Next.js 15 (with Turbopack)
- **Task Queue**: BullMQ with Redis

## Commands

### Package Management
```bash
bun install              # Install all dependencies
bun add package-name     # Add new package
bun remove package-name  # Remove package
```

### Development
```bash
bun run dev              # Start Next.js dev server with Turbopack
bun run build            # Build for production
bun run start            # Start production server
bun run lint             # Run ESLint
bun run typecheck        # Run TypeScript type checking
```

### Database
```bash
bun prisma generate      # Generate Prisma client
bun prisma migrate dev   # Run migrations
bun prisma migrate reset # Reset database
bun prisma studio        # Open Prisma UI
```

### Worker
```bash
bun run worker           # Start background workers
bun run worker:dev       # Start workers with watch mode
```

## Key Differences from npm/pnpm

| Feature | npm/pnpm | Bun |
|---------|----------|-----|
| Lock file | `package-lock.json`/`pnpm-lock.yaml` | `bun.lockb` |
| Run script | `npm run dev` | `bun run dev` |
| Run TypeScript | `tsx file.ts` | `bun file.ts` |
| Execute package | `npx pkg` | `bun x pkg` |

## Native TypeScript Support

Bun runs TypeScript directly without compilation:
```bash
bun src/scripts/start-worker-bun.ts
bun --watch src/scripts/start-worker-bun.ts  # Watch mode
```

## Docker Configuration

The project uses multi-stage Docker builds:
- **Build stages**: `imbios/bun-node` (Bun + Node.js for Prisma compatibility)
- **Runtime**: `oven/bun` (pure Bun for production)

### Building Images
```bash
# Application
docker build -t carousel-app:latest .

# Worker
docker build -f worker.Dockerfile -t carousel-worker:latest .
```

## Environment Variables

Required for worker processes:
- `REDIS_URL` - BullMQ Redis connection
- `DATABASE_URL` - PostgreSQL direct connection
- `DATABASE_URL_POOLING` - PostgreSQL pooled connection

## Troubleshooting

### Worker fails to connect to Redis
- Ensure `lazyConnect: false` in Redis config
- Verify `REDIS_URL` is set correctly

### Module not found
- Run `bun install` to refresh dependencies
- Check `tsconfig.json` paths
