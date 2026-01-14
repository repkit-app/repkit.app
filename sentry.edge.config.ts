import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: 1.0,

  sendDefaultPii: false,

  beforeSend(event) {
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
