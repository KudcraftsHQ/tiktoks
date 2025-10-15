/**
 * Sentry Worker Configuration
 *
 * Initializes Sentry for the background worker process.
 * This handles error tracking for BullMQ job processing.
 */

import * as Sentry from "@sentry/node";

/**
 * Initialize Sentry for the worker process
 */
export function initSentryWorker() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Adjust this value in production
    tracesSampleRate: 1.0,

    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,

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

  console.log("✅ Sentry initialized for worker process");
}

/**
 * Set context for a worker job
 * Call this at the start of job processing to add context to errors
 */
export function setJobContext(jobName: string, jobId: string, jobData: any) {
  Sentry.setTag("job.name", jobName);
  Sentry.setTag("job.id", jobId);
  Sentry.setContext("job", {
    name: jobName,
    id: jobId,
    data: jobData,
  });
}

/**
 * Capture an error with job context
 */
export function captureJobError(
  error: Error,
  jobName: string,
  jobId: string,
  jobData?: any
) {
  Sentry.withScope((scope) => {
    scope.setTag("job.name", jobName);
    scope.setTag("job.id", jobId);
    scope.setLevel("error");

    if (jobData) {
      scope.setContext("job", {
        name: jobName,
        id: jobId,
        data: jobData,
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Flush Sentry events before shutdown
 */
export async function flushSentry() {
  try {
    await Sentry.close(2000); // Wait up to 2 seconds for pending events
  } catch (error) {
    console.error("Error flushing Sentry:", error);
  }
}
