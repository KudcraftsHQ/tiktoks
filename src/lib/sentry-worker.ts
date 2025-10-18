/**
 * Sentry Worker Configuration
 *
 * Initializes Sentry for the background worker process.
 * This handles error tracking for BullMQ job processing.
 */

import * as Sentry from "@sentry/node";
import { Queue } from "bullmq";

/**
 * Initialize Sentry for the worker process
 */
export function initSentryWorker() {
  // Use same DSN as server if SENTRY_DSN not specifically set
  const dsn = process.env.SENTRY_DSN || 
    "https://29de806860ecdb2fa86f5b031a1e66cb@o1127849.ingest.us.sentry.io/4510185243738112";

  Sentry.init({
    dsn,

    // Adjust this value in production
    tracesSampleRate: 1.0,

    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,

    debug: false,

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
 * Setup Sentry listeners for BullMQ queue events
 * Provides comprehensive job lifecycle monitoring and error tracking
 */
export function setupQueueSentryListeners(
  queue: Queue<any>,
  queueName: string
) {
  console.log(`🎧 [Sentry] Setting up listeners for queue: ${queueName}`);

  // Track completed jobs (for successful completions)
  (queue as any).on("completed", (job: any) => {
    Sentry.withScope((scope) => {
      scope.setTag("job.status", "completed");
      scope.setTag("job.queue", queueName);
      scope.setTag("job.name", job.name);
      scope.setContext("job", {
        jobId: job.id,
        duration: job.finishedOn ? job.finishedOn - (job.processedOn || 0) : 0,
      });
      Sentry.captureMessage(`Job completed: ${job.name}`, "info");
    });
  });

  // Track failed jobs with full context
  (queue as any).on("failed", (job: any, err: any) => {
    Sentry.withScope((scope) => {
      scope.setTag("job.status", "failed");
      scope.setTag("job.queue", queueName);
      scope.setTag("job.name", job.name);
      scope.setLevel("error");
      scope.setContext("job", {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        data: job.data,
        failedReason: err instanceof Error ? err.message : String(err),
      });
      Sentry.captureException(err);
    });
    console.error(
      `❌ [Sentry] Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      err instanceof Error ? err.message : String(err)
    );
  });

  // Track stalled jobs (jobs that are taking too long)
  (queue as any).on("stalled", (jobId: string, prev: string) => {
    Sentry.withScope((scope) => {
      scope.setTag("job.status", "stalled");
      scope.setTag("job.queue", queueName);
      scope.setLevel("warning");
      scope.setContext("job", {
        jobId,
        previousState: prev,
      });
      Sentry.captureMessage(`Job stalled: ${jobId}`, "warning");
    });
    console.warn(
      `⚠️ [Sentry] Job ${jobId} stalled (previous state: ${prev})`
    );
  });

  // Track delayed jobs (jobs waiting to be processed)
  (queue as any).on("delayed", (job: any, delay: number) => {
    Sentry.withScope((scope) => {
      scope.setTag("job.status", "delayed");
      scope.setTag("job.queue", queueName);
      scope.setTag("job.name", job.name);
      scope.setContext("job", {
        jobId: job.id,
        delayMs: delay,
      });
      Sentry.captureMessage(`Job delayed: ${job.name}`, "info");
    });
  });

  // Track queue errors (e.g., Redis connection issues)
  (queue as any).on("error", (err: any) => {
    Sentry.captureException(err, {
      tags: {
        "error.type": "queue",
        "error.queue": queueName,
      },
      level: "error",
    });
    console.error(`❌ [Sentry] Queue ${queueName} error:`, err);
  });

  console.log(
    `✅ [Sentry] Queue ${queueName} monitoring enabled with Sentry`
  );
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
