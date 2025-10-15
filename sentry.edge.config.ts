/**
 * Sentry Edge Runtime Configuration
 *
 * Initializes Sentry for Next.js Edge runtime.
 * This runs on Edge functions and middleware.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment detection
  environment: process.env.NODE_ENV || "development",

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
