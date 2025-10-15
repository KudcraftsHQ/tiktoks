# Canvas Platform Support

This document explains how the @napi-rs/canvas platform-specific bindings work in this project.

## How It Works

The `@napi-rs/canvas` package requires platform-specific native bindings to function. The package automatically detects your platform and architecture at runtime and loads the correct binding.

### Supported Platforms

We have configured optional dependencies for the following platforms:

| Platform | Architecture | Package |
|----------|-------------|---------|
| macOS    | ARM64 (M1/M2/M3) | `@napi-rs/canvas-darwin-arm64` |
| macOS    | x64 (Intel) | `@napi-rs/canvas-darwin-x64` |
| Linux    | ARM64 | `@napi-rs/canvas-linux-arm64-gnu` |
| Linux    | x64 | `@napi-rs/canvas-linux-x64-gnu` |

### How Platform Detection Works

1. **Installation**: When you run `pnpm install`, pnpm will only download the platform-specific binding for your current platform
2. **Runtime**: The `@napi-rs/canvas` package automatically detects `process.platform` and `process.arch` and loads the appropriate binding
3. **Deployment**: When you deploy to a different platform (e.g., Linux ARM64 server), `pnpm install` will automatically download the correct binding for that platform

### Testing Platform Detection

You can verify that the correct binding is loaded by running:

```bash
node test-canvas-platform.js
```

This will:
- Display your current platform and architecture
- Show which binding should be loaded
- Test canvas creation, drawing, and PNG export
- Confirm everything is working correctly

### Deployment Guide

#### Deploying to Linux ARM64 Server

When deploying to a Linux ARM64 server:

1. The server will run `pnpm install` during deployment
2. pnpm will detect the platform as `linux` with arch `arm64`
3. It will automatically download `@napi-rs/canvas-linux-arm64-gnu`
4. The canvas functionality will work without any code changes

**No code changes needed!** The platform detection is automatic.

#### Docker Deployment

If you're using Docker, make sure your Dockerfile:

1. Uses the correct base image for your target platform (e.g., `node:22-alpine` for Alpine Linux)
2. Runs `pnpm install` inside the container (so it installs the correct binding)
3. Doesn't copy `node_modules` from your local machine (which has the darwin binding)

Example Dockerfile pattern:
```dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (will install correct platform binding)
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build
RUN pnpm build

CMD ["pnpm", "start"]
```

### Troubleshooting

#### "Failed to load native binding" Error

If you see this error:

1. **Check platform support**: Make sure your platform/architecture combination is in the optionalDependencies list
2. **Verify installation**: Run `pnpm list | grep canvas` to see which bindings are installed
3. **Reinstall**: Try `pnpm install --force` to reinstall dependencies
4. **Check Node version**: @napi-rs/canvas requires Node.js >= 10

#### Adding Support for Additional Platforms

To add support for additional platforms (e.g., Windows, FreeBSD), add the appropriate package to `optionalDependencies` in `package.json`:

```json
{
  "optionalDependencies": {
    "@napi-rs/canvas-win32-x64-msvc": "^0.1.79",
    "@napi-rs/canvas-freebsd-x64": "^0.1.79"
  }
}
```

See the [@napi-rs/canvas documentation](https://github.com/Brooooooklyn/canvas) for all available platform packages.

### Logging

When the export service initializes, it logs the platform information:

```
🎨 [Export] Initializing canvas module...
🎨 [Export] Platform: linux, Architecture: arm64
🎨 [Export] Canvas module loaded successfully
✅ [Export] Canvas initialized successfully
```

This helps verify that the correct binding is being used in production.

## Technical Details

### Why Optional Dependencies?

We use `optionalDependencies` instead of regular `dependencies` because:

1. **Smaller installs**: Only the binding for your platform is downloaded
2. **Cross-platform support**: Different platforms can use different bindings
3. **Graceful failures**: If a binding isn't available, the install doesn't fail

### Package Resolution

The `@napi-rs/canvas` package's `js-binding.js` file contains logic to:

1. Check `process.platform` and `process.arch`
2. Try to require the appropriate platform package
3. Fall back to alternative bindings if the first choice isn't available
4. Throw a helpful error if no compatible binding is found

This means the platform detection is handled by the @napi-rs/canvas package itself, not by our code.

## Summary

✅ **Automatic platform detection** - No manual configuration needed  
✅ **Cross-platform deployment** - Works on Darwin (macOS) and Linux ARM64/x64  
✅ **Optimized installs** - Only downloads bindings for your platform  
✅ **Production ready** - Tested and verified to work correctly
