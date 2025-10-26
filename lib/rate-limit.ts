/**
 * Simple in-memory rate limiter
 * Tracks requests per identifier (device token or IP address)
 *
 * Note: This is a simple implementation suitable for single-instance deployments.
 * For production with multiple instances, use Redis or similar distributed storage.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  WITH_TOKEN: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || "100"),
  WITHOUT_TOKEN: parseInt(
    process.env.RATE_LIMIT_REQUESTS_PER_HOUR_NO_TOKEN || "50"
  ),
  WINDOW_MS: 60 * 60 * 1000, // 1 hour in milliseconds
};

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Check if a request is allowed under rate limits
 *
 * @param identifier - Device token or IP address
 * @param hasDeviceToken - Whether the request includes a device token
 * @returns Object with allowed status and limit info
 */
export function checkRateLimit(identifier: string, hasDeviceToken: boolean): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const limit = hasDeviceToken
    ? RATE_LIMITS.WITH_TOKEN
    : RATE_LIMITS.WITHOUT_TOKEN;

  let entry = rateLimitStore.get(identifier);

  // Initialize or reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + RATE_LIMITS.WINDOW_MS,
    };
    rateLimitStore.set(identifier, entry);
  }

  // Check if limit exceeded
  if (entry.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(rateLimit: {
  limit: number;
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": rateLimit.limit.toString(),
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
  };
}
