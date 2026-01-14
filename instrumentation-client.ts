import * as Sentry from "@sentry/nextjs";

/**
 * Initialize Sentry for browser client-side errors.
 *
 * This configuration tracks client-side errors and performance with privacy-first data scrubbing.
 * Session replays are captured with text/media masking to prevent sensitive data leakage while
 * still providing context for debugging UI issues.
 *
 * Privacy guarantees:
 * - Session replays mask all text and block all media files
 * - Auth headers, device tokens, and request signatures are removed
 * - User email and IP address are never sent
 * - Query strings are redacted to prevent sensitive data in URLs
 * - No user PII is sent to Sentry (sendDefaultPii: false)
 *
 * Performance:
 * - 100% trace sampling for full visibility on client-side operations
 * - 10% session replay rate for performance efficiency
 * - 100% session replay rate for error scenarios (100% of sessions with errors recorded)
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment detection
  environment: process.env.NODE_ENV,

  // Sample rates (100% traces for full performance visibility on API endpoints)
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Privacy: Do NOT send default PII
  sendDefaultPii: false,

  // Data scrubbing hook to remove sensitive information
  beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
    // Remove any accidentally captured sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["x-device-token"];
      delete event.request.headers["x-request-signature"];
      delete event.request.headers["x-request-timestamp"];
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }

    // Remove query parameters that might contain sensitive data
    if (event.request?.query_string) {
      event.request.query_string = "[REDACTED]";
    }

    // Don't send user email/IP
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    return event;
  },

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
