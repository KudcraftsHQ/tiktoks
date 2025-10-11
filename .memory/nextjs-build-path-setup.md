# Next.js Different Build Path Setup for Dev Environment

## Overview
This project uses **different build output directories** for development and production environments to prevent conflicts when running both environments simultaneously (e.g., local dev server while production is deployed).

## Configuration

### 1. Next.js Configuration (`next.config.ts`)

The key configuration is in the `distDir` option:

```typescript
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // ... other config
};
```

**How it works:**
- **Development** (`NODE_ENV=development`): Builds to `.next-dev/` directory
- **Production** (`NODE_ENV=production`): Builds to `.next/` directory (default)

### 2. Git Ignore (`.gitignore`)

Both build directories are excluded from version control:

```gitignore
# next.js
/.next/
/.next-dev/
/out/
```

### 3. Package Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start"
  }
}
```

## Why This Setup?

### Benefits

1. **Concurrent Development & Production**
   - Run local dev server while production build exists
   - No build cache conflicts between environments
   - Safe to have production Docker containers and dev server simultaneously

2. **Clean Environment Separation**
   - Development builds don't pollute production cache
   - Different optimization strategies per environment
   - Easier debugging with separate build artifacts

3. **Docker/Container Friendliness**
   - Production builds in `.next/` can be used in Docker images
   - Dev builds in `.next-dev/` won't interfere with container builds
   - Build layers can be cached independently

## How It Works

### Development Mode
```bash
pnpm dev
# NODE_ENV=development is automatically set by Next.js
# Builds to: .next-dev/
```

### Production Build
```bash
pnpm build
# NODE_ENV=production is automatically set by Next.js build
# Builds to: .next/
```

### Production Start
```bash
pnpm start
# Uses the .next/ directory from production build
```

## Important Notes

⚠️ **Environment Detection**: Next.js automatically sets `NODE_ENV`:
- `next dev` → `NODE_ENV=development`
- `next build` → `NODE_ENV=production`
- `next start` → `NODE_ENV=production`

⚠️ **Testing Builds**: To test production builds locally:
```bash
pnpm build  # Creates .next/ directory
pnpm start  # Runs production server
```

⚠️ **File Size**: Both `.next/` and `.next-dev/` can be large. Ensure both are in `.gitignore`.

## Related Configuration

This setup works alongside:
- **Turbopack**: Enabled for both dev and build (`--turbopack` flag)
- **Standalone Output**: `output: 'standalone'` for optimized Docker deployments
- **Server Externals**: Native modules like `@napi-rs/canvas` are properly externalized

## Troubleshooting

### Issue: Wrong build directory used
**Solution**: Check `NODE_ENV` environment variable
```bash
echo $NODE_ENV
```

### Issue: Build cache conflicts
**Solution**: Clear both directories
```bash
rm -rf .next .next-dev
```

### Issue: Production build in dev
**Solution**: Make sure you're using `pnpm dev`, not `pnpm build && pnpm start`

## Additional Context

This setup is particularly useful for:
- **Docker Development**: Production image builds won't conflict with local dev
- **CI/CD Pipelines**: Different artifacts for staging/production
- **Multi-environment Testing**: Test prod builds without stopping dev server
- **Large Teams**: Multiple developers can work on different environments simultaneously

## Examples

### Example 1: Running Dev and Testing Prod Build
```bash
# Terminal 1: Development server
pnpm dev
# Access: http://localhost:3000
# Uses: .next-dev/

# Terminal 2: Production build & server
pnpm build && pnpm start
# Access: http://localhost:3001 (different port)
# Uses: .next/
```

### Example 2: Docker Production Build
```dockerfile
# Production build automatically uses .next/
RUN pnpm build

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
```

## Version History
- **Created**: 2025-01-11
- **Last Updated**: 2025-01-11
- **Next.js Version**: 15.5.2
- **Node Version**: 20+
