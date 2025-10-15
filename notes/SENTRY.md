# Sentry Error Tracking

This project uses Sentry for error tracking and monitoring across both the Next.js web application and the Node.js worker process.

## Environment Variables

Add these environment variables to your `.env` file:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-public-key@o0.ingest.sentry.io/0
SENTRY_DSN=https://your-public-key@o0.ingest.sentry.io/0

# Optional: For source map uploads
SENTRY_ORG=your-org-name
SENTRY_PROJECT=your-project-name
SENTRY_AUTH_TOKEN=your-auth-token
```

### Getting Your DSN

1. Create a Sentry account at [sentry.io](https://sentry.io)
2. Create a new project for your application
3. Copy the DSN from the project settings
4. Use the same DSN for both `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` (or use separate projects if you want to split web app and worker errors)

## What's Configured

### Next.js Web App

#### Client-Side Error Tracking
- Configured in `instrumentation-client.ts`
- Captures browser JavaScript errors
- Includes session replay for debugging (10% of sessions, 100% of errors)
- Tracks router transitions for performance monitoring
- **Development mode**: Errors are logged to console but not sent to Sentry

#### Server-Side Error Tracking
- Configured in `sentry.server.config.ts`
- Captures API route errors
- Captures server component errors
- Includes request context (headers, body, user info)
- **Development mode**: Errors are logged to console but not sent to Sentry

#### Edge Runtime Error Tracking
- Configured in `sentry.edge.config.ts`
- Captures errors from Edge functions and middleware
- **Development mode**: Errors are logged to console but not sent to Sentry

#### Global Error Boundary
- Located at `src/app/global-error.tsx`
- Catches unhandled React errors
- Automatically reports to Sentry

### Worker Process

- Configured in `src/lib/sentry-worker.ts`
- Captures errors from BullMQ job processing
- Tracks uncaught exceptions and unhandled promise rejections
- Automatically flushes events on shutdown
- **Development mode**: Errors are logged to console but not sent to Sentry

## Adding Error Context

### In API Routes

```typescript
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  try {
    // Your code here
  } catch (error) {
    // Add context to the error
    Sentry.withScope((scope) => {
      scope.setTag('api-route', '/api/your-route')
      scope.setTag('http-method', 'POST')
      scope.setContext('request-details', {
        // Add any relevant context
        userId: 'user-123',
        resourceId: 'resource-456'
      })
      Sentry.captureException(error)
    })

    throw error
  }
}
```

### In Worker Jobs

Worker jobs automatically get context from `setJobContext()` at the start of processing. For additional context within a job:

```typescript
import * as Sentry from '@sentry/node'

// Add custom tags
Sentry.setTag('custom-tag', 'value')

// Add custom context
Sentry.setContext('custom-context', {
  key: 'value'
})

// Capture an error with scoped context
Sentry.withScope((scope) => {
  scope.setTag('error-type', 'specific-error')
  scope.setContext('error-details', {
    detail1: 'value1',
    detail2: 'value2'
  })
  Sentry.captureException(error)
})
```

### Useful Context Methods

```typescript
// Set user information
Sentry.setUser({
  id: 'user-123',
  email: 'user@example.com',
  username: 'johndoe'
})

// Set tags (searchable/filterable in Sentry)
Sentry.setTag('feature', 'media-cache')
Sentry.setTag('environment', 'production')

// Set context (structured data visible in error details)
Sentry.setContext('media-details', {
  url: 'https://...',
  fileSize: 1024000,
  contentType: 'image/jpeg'
})

// Capture a message (not an error)
Sentry.captureMessage('Something interesting happened', 'info')

// Capture an exception
Sentry.captureException(error)
```

## Example: Worker Job Error

The worker is already configured to automatically capture errors with full context:

```typescript
// This happens automatically in media-cache-worker.ts and profile-monitor-worker.ts
setJobContext(QUEUE_NAMES.MEDIA_CACHE, job.id!, job.data)

// When an error occurs, it's automatically captured with:
// - Job name
// - Job ID
// - Job data
// - Stack trace
// - Environment info
```

## Source Maps

Source maps are automatically uploaded when you build the application if you have `SENTRY_AUTH_TOKEN` configured. This allows you to see readable stack traces in production.

To generate an auth token:
1. Go to Sentry Settings → Account → API → Auth Tokens
2. Create a new token with `project:releases` and `org:read` scopes
3. Add it to your `.env` as `SENTRY_AUTH_TOKEN`

## Development vs Production

- **Development**: Errors are logged to console but **not sent to Sentry**
- **Production**: Errors are sent to Sentry with full context

This behavior is controlled by `process.env.NODE_ENV` in each config file.

## Testing Your Setup

### Test Client-Side Errors

Add a button to any page:

```tsx
<button onClick={() => { throw new Error('Test client error') }}>
  Test Sentry
</button>
```

### Test Server-Side Errors

Create a test API route at `src/app/api/test-sentry/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  throw new Error('Test server error')
}
```

Then visit `/api/test-sentry` in your browser.

### Test Worker Errors

The worker automatically captures uncaught exceptions and job failures. Check the Sentry dashboard after a job fails.

## Viewing Errors in Sentry

1. Go to your Sentry dashboard
2. Navigate to Issues
3. Click on any error to see:
   - Stack trace
   - Error context (tags, user info, request details)
   - Breadcrumbs (actions leading up to the error)
   - Session replay (for client errors)
   - Environment info

## Best Practices

1. **Always add context to errors** - Include relevant IDs, user info, request details
2. **Use tags for filtering** - Tag errors by feature, user type, etc.
3. **Don't log sensitive data** - Avoid logging passwords, tokens, or PII
4. **Set appropriate sample rates** - Adjust `tracesSampleRate` and `replaysSessionSampleRate` for production
5. **Monitor performance** - Use Sentry's performance monitoring to track slow operations
6. **Review errors regularly** - Set up alerts for critical errors

## Disabling in Development

If you want to send errors to Sentry even in development, remove or modify the `beforeSend` hooks in:
- `instrumentation-client.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `src/lib/sentry-worker.ts`

## Further Reading

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Enriching Error Events](https://docs.sentry.io/platforms/javascript/enriching-events/)
