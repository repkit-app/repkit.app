import * as Sentry from "@sentry/nextjs";

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
  beforeSend(event, hint) {
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
