/**
 * Sentry Client-Side Configuration
 *
 * Initializes Sentry for browser/client-side error tracking.
 * This runs in the user's browser.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Use environment variable if available, fallback to hardcoded DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://29de806860ecdb2fa86f5b031a1e66cb@o1127849.ingest.us.sentry.io/4510185243738112",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // This option will automatically capture error context like:
  // - Request headers
  // - IP address
  // - User info
  sendDefaultPii: true,

  // Environment detection (default to production if not specified)
  environment: process.env.NODE_ENV || "production",

  // Integrations for enhanced error tracking
  integrations: [
    // Session replay - captures user interactions leading to errors
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Session Replay sampling rates
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Filter which errors are sent to Sentry
  beforeSend(event, _hint) {
    // Always log errors to console for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("🐛 Sentry Client Error (dev - not sent to Sentry):", {
        message: event.message,
        exception: event.exception,
        level: event.level,
        tags: event.tags,
        contexts: event.contexts
      });
      return null; // Don't send to Sentry in development
    }

    // In production, log that we're sending to Sentry
    console.log("📡 Sending error to Sentry:", event.message || event.exception);
    return event;
  },
});

// Export router transition tracking (optional - for performance monitoring)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
