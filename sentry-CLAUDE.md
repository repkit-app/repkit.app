# Sentry Error Monitoring Patterns

## Overview

This document describes the patterns and conventions for the Sentry error monitoring integration in repkit.app. Sentry captures production errors, performance metrics, and user session replays while maintaining strict privacy guarantees through data scrubbing.

## Configuration Files

### Three Runtime Configurations

Sentry is configured separately for each Next.js runtime:

1. **`instrumentation-client.ts`** - Browser client-side errors
2. **`sentry.server.config.ts`** - Node.js server-side errors
3. **`sentry.edge.config.ts`** - Vercel Edge runtime errors

Each config initializes Sentry with runtime-specific settings while enforcing identical privacy protections.

### Key Configuration Principles

#### Privacy First: Data Scrubbing

All three configs implement `beforeSend` hooks that remove sensitive data:

**Headers Removed:**
- `x-device-token` - HMAC device identifier (auth credential)
- `x-request-signature` - Request signature for validation
- `x-request-timestamp` - Request timestamp for signature verification
- `authorization` - OAuth/Bearer tokens
- `cookie` - Session cookies

**Environment Variables Removed (Server Only):**
- `OPENAI_API_KEY` - OpenAI credentials
- `HMAC_SECRET` - HMAC key for signing
- `LOG_HASH_KEY` - Hashing key for anonymization
- `UPSTASH_REDIS_REST_TOKEN` - Redis credentials
- `SENTRY_AUTH_TOKEN` - Sentry credentials

**User Data Removed (Client Only):**
- `email` - User email address
- `ip_address` - Client IP address

**Query Strings Redacted:**
- All query parameters are replaced with `[REDACTED]` to prevent sensitive data in URLs

#### Data SAFE to Send

The `beforeSend` hooks preserve this data (already anonymized):

- HMAC-anonymized identifiers: `token#abc123`, `ip#def456` (safe - already hashed)
- Request IDs (UUIDs)
- Error types and stack traces
- HTTP status codes
- API endpoint paths
- Model names (`gpt-5-mini`, `gpt-5.2`)
- Request duration (performance metrics)

### Sample Rates

- **Traces:** 100% sampling for full visibility on all transactions
- **Session Replays (Client):** 10% of sessions, 100% of error sessions

## API Route Error Reporting

### Pattern: Capture with Sanitized Context

When errors occur in API routes (`app/api/ai/chat/mini/route.ts`, `app/api/ai/chat/standard/route.ts`), use this pattern:

```typescript
catch (error: unknown) {
  const duration = Date.now() - startTime;
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorType = error instanceof Error ? error.constructor.name : "Unknown";

  // Capture to Sentry with sanitized context
  Sentry.captureException(error, {
    tags: {
      endpoint: "/api/ai/chat/mini",
      model: "gpt-5-mini",
      error_type: errorType,
    },
    extra: {
      requestId,              // UUID - safe to send
      duration_ms: duration,  // Performance metric
      // DO NOT include: deviceToken, ip, signature
    },
    fingerprint: ["api-error", "openai", errorType],
  });

  // Existing console log with HMAC anonymization (unchanged)
  console.error("[API Error]", {
    requestId,
    model: "gpt-5-mini",
    error: errorMessage,
    type: errorType,
    duration: `${duration}ms`,
  });
}
```

**Key Rules:**
1. Always include `requestId` for correlation with Vercel logs
2. Always include `duration_ms` for performance analysis
3. NEVER include sensitive fields (deviceToken, ip, signature)
4. Use consistent `error_type` tags for grouping
5. Keep `fingerprint` array consistent for issue deduplication

### Pattern: OpenAI Client Error Tracking

Wrap OpenAI client calls in try-catch to track service-specific errors:

```typescript
try {
  const completion = await client.chat.completions.create({...});
  return completion;
} catch (error: unknown) {
  Sentry.captureException(error, {
    tags: {
      service: "openai",
      model
    },
    extra: {
      message_count: request.messages.length,
      has_tools: Boolean(request.tools),
    },
  });
  throw error; // Re-throw for API route to handle
}
```

**Key Rules:**
1. Capture OpenAI-specific context (model, message count)
2. NEVER include message content (could contain user data)
3. Re-throw after capturing for proper error handling
4. Let API route handle the response to user

## Global Error Boundary

The `app/global-error.tsx` component captures unhandled React errors:

```typescript
useEffect(() => {
  Sentry.captureException(error);
}, [error.digest]); // CRITICAL: Use error.digest, NOT error
```

**Key Rule:** Dependency must be `[error.digest]` not `[error]`:
- `error.digest` is stable per unique error (prevents re-renders)
- `error` reference changes on each render (causes infinite loop)

## Common Mistakes to Avoid

### ❌ Including Sensitive Context

```typescript
// WRONG - includes auth credential
extra: {
  deviceToken,
  signature,
}

// CORRECT - only includes safe identifiers
extra: {
  requestId,
}
```

### ❌ Wrong useEffect Dependency

```typescript
// WRONG - causes infinite re-render loop
useEffect(() => {
  Sentry.captureException(error);
}, [error])

// CORRECT - stable per unique error
useEffect(() => {
  Sentry.captureException(error);
}, [error.digest])
```

### ❌ Removing beforeSend Hooks

The `beforeSend` hooks are critical privacy protection:

```typescript
// WRONG - removes privacy protection
beforeSend(event) {
  return event; // No scrubbing!
}

// CORRECT - maintains privacy
beforeSend(event) {
  // Scrub sensitive headers and env vars
  if (event.request?.headers) {
    delete event.request.headers["x-device-token"];
    delete event.request.headers["authorization"];
  }
  return event;
}
```

## Testing Sentry Integration

### Local Testing

1. Create a test endpoint:
```typescript
// app/api/test-sentry/route.ts
export async function GET() {
  Sentry.captureException(new Error("Test Sentry"), {
    tags: { test: "true" },
  });
  return NextResponse.json({ error: "Test sent" }, { status: 500 });
}
```

2. Trigger error: `curl http://localhost:3000/api/test-sentry`

3. Check Sentry dashboard for error with tag `test: true`

### Production Verification

1. Check Sentry: [Sentry Dashboard](https://sentry.io/organizations/rustpoint/issues/)
2. Verify errors appear with:
   - `environment: production` tag
   - Readable stack traces (source maps applied)
   - Sanitized context (no auth headers visible)
3. Verify request IDs match Vercel logs for correlation

## Performance Impact

- **Client:** Negligible (<5ms overhead per transaction)
- **Server:** <1ms overhead per error capture
- **Edge:** Minimal - configured for edge constraints

Session replays are sampled (10%) to avoid performance impact.

## See Also

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Root CLAUDE.md](./CLAUDE.md) for project-wide privacy policies
- Issue #34: Original Sentry integration
- Issue #36: Documentation and docstring improvements
