export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  err: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  }
) => {
  const Sentry = await import("@sentry/nextjs");

  Sentry.captureException(err, {
    contexts: {
      request: {
        method: request.method,
        url: request.path,
        // Don't include headers - they're scrubbed in beforeSend
      },
    },
  });
};
