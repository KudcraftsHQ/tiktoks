/**
 * Sentry Client-Side Configuration
 *
 * Initializes Sentry for browser/client-side error tracking.
 * This runs in the user's browser.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // This option will automatically capture error context like:
  // - Request headers
  // - IP address
  // - User info
  sendDefaultPii: true,

  // Environment detection
  environment: process.env.NODE_ENV || "development",

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

  // You can filter which errors are sent to Sentry
  beforeSend(event, hint) {
    // Don't send errors in development unless you want to test
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry Error (dev - not sent):", event);
      return null;
    }
    return event;
  },
});

// Export router transition tracking (optional - for performance monitoring)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
