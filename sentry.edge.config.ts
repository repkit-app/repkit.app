import * as Sentry from "@sentry/nextjs";

/**
 * Initialize Sentry for Edge Runtime (Vercel Edge Functions).
 *
 * This configuration tracks errors in edge middleware and edge routes with comprehensive
 * privacy protections. The edge runtime has stricter resource constraints, so configuration
 * is minimal while maintaining privacy guarantees.
 *
 * Privacy guarantees:
 * - API keys, secrets, and auth credentials are removed
 * - Request headers containing sensitive data (device tokens, signatures) are redacted
 * - Request query strings are fully redacted
 * - No user PII is sent to Sentry (sendDefaultPii: false)
 *
 * Performance:
 * - 100% trace sampling for visibility on edge runtime operations
 * - Lightweight initialization suitable for edge computing constraints
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: 1.0,

  sendDefaultPii: false,

  beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
    // Scrub request headers
    if (event.request?.headers) {
      delete event.request.headers["x-device-token"];
      delete event.request.headers["x-request-signature"];
      delete event.request.headers["x-request-timestamp"];
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }

    // Remove query strings
    if (event.request?.query_string) {
      event.request.query_string = "[REDACTED]";
    }

    return event;
  },
});
