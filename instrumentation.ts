/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js and runs on server startup.
 * It initializes Sentry for different runtimes (Node.js, Edge).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
