import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Performance monitoring (100% traces for full visibility on API endpoints)
  tracesSampleRate: 1.0,

  // Privacy: Do NOT send default PII
  sendDefaultPii: false,

  // Data scrubbing for server-side errors
  beforeSend(event, hint) {
    // Scrub sensitive environment variables
    if (event.extra) {
      delete event.extra.OPENAI_API_KEY;
      delete event.extra.HMAC_SECRET;
      delete event.extra.LOG_HASH_KEY;
      delete event.extra.UPSTASH_REDIS_REST_TOKEN;
      delete event.extra.SENTRY_AUTH_TOKEN;
    }

    // Scrub request headers
    if (event.request?.headers) {
      delete event.request.headers["x-device-token"];
      delete event.request.headers["x-request-signature"];
      delete event.request.headers["x-request-timestamp"];
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }

    // Remove query strings that might contain sensitive data
    if (event.request?.query_string) {
      event.request.query_string = "[REDACTED]";
    }

    // Preserve anonymized identifiers from existing logs
    // If the original error contains "token#abc123" or "ip#def456",
    // those are safe to send (already HMAC anonymized)

    return event;
  },
});
