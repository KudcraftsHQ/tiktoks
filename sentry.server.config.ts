/**
 * Sentry Server-Side Configuration
 *
 * Initializes Sentry for Next.js server-side code and API routes.
 * This runs on your server/Node.js runtime.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // This option will automatically capture error context like:
  // - Request headers
  // - Request body (be careful with sensitive data)
  // - User info
  sendDefaultPii: true,

  // Environment detection
  environment: process.env.NODE_ENV || "development",

  // You can filter which errors are sent to Sentry
  beforeSend(event, _hint) {
    // Don't send errors in development unless you want to test
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry Error (dev - not sent):", event);
      return null;
    }
    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
});
