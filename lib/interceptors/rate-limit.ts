/**
 * Rate Limiting Interceptor
 * Enforces dual-bucket rate limiting (device token + IP address)
 */

import type { Interceptor } from '@connectrpc/connect';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  checkRateLimit,
  getRateLimitHeaders,
} from '@/lib/rate-limit';
import { anonymize } from '@/lib/utils/anonymize';
import { logger } from '@/lib/utils/logger';

/**
 * Rate Limit Interceptor
 * Enforces dual-bucket rate limiting on all Connect RPC requests
 *
 * Rate limits:
 * - 100 requests/hour with valid device token
 * - 50 requests/hour by IP address (fallback)
 * - Both must be within limits (AND logic, not OR)
 *
 * Error handling:
 * - Returns RESOURCE_EXHAUSTED (429) if limit exceeded
 * - Includes X-RateLimit-* headers in response
 * - Includes Retry-After header for client backoff
 *
 * Device Token Tracking:
 * - Extracted from request message (not headers)
 * - Persists across requests from same app install
 * - Falls back to IP address if token missing
 */
export const rateLimitInterceptor: Interceptor = (next) => {
  return async (req) => {
    // Apply rate limiting to both unary and streaming requests
    // Streaming consumes bandwidth/resources same as unary, just over longer duration

    // Extract rate limit identifiers from request message using bracket notation
    // This avoids type casting and is type-safe
    const msg = req.message as Record<string, unknown>;
    const deviceToken = typeof msg['deviceToken'] === 'string'
      ? String(msg['deviceToken'])
      : undefined;

    // Get client IP from request headers
    // Priority: Cloudflare Edge IP > Real IP > First X-Forwarded-For > fallback
    const headers = req.header;
    const cfIp = headers.get('cf-connecting-ip')?.trim();
    const realIp = headers.get('x-real-ip')?.trim();
    const xff = headers.get('x-forwarded-for') || '';
    const xffFirst = xff.split(',')[0]?.trim();
    const ip = cfIp || realIp || xffFirst || '0.0.0.0';

    // Check rate limits (both token and IP must be within limits)
    const tokenRate = deviceToken
      ? await checkRateLimit(deviceToken, true)
      : null;
    const ipRate = await checkRateLimit(ip, false);

    // Determine if rate limit is violated (both must be within limits - AND logic)
    const tokenViolated = tokenRate && !tokenRate.allowed;
    const ipViolated = !ipRate.allowed;
    const violated = tokenViolated ? tokenRate : ipViolated ? ipRate : null;

    if (violated) {
      logger.warn('Rate limit exceeded', {
        method: req.method.name,
        identifier: deviceToken
          ? `token#${anonymize(deviceToken)}`
          : `ip#${anonymize(ip)}`,
        limit: violated.limit,
        reset_at: new Date(violated.resetAt).toISOString(),
      });

      const retryAfter = Math.max(
        0,
        Math.ceil((violated.resetAt - Date.now()) / 1000)
      );

      // Create response headers with rate limit info
      const rateLimitHeaders = getRateLimitHeaders(violated);
      const responseHeaders: Record<string, string> = {
        ...rateLimitHeaders,
        'Retry-After': retryAfter.toString(),
      };

      throw new ConnectError(
        `Rate limit exceeded: ${violated.limit} requests per hour. Retry after ${retryAfter}s`,
        Code.ResourceExhausted,
        undefined,
        undefined,
        Object.entries(responseHeaders).map(([key, value]) => [key, value])
      );
    }

    // Rate limit check passed - continue to next handler
    return await next(req);
  };
};
