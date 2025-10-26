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
 * Lazy cleanup: Remove expired entries on-demand
 * Runs at most once every 5 minutes to avoid overhead
 */
let lastCleanupAt = 0;
function cleanupExpired(now: number) {
  // At most once every 5 minutes
  if (now - lastCleanupAt < 5 * 60 * 1000) return;
  lastCleanupAt = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

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
  cleanupExpired(now); // Lazy cleanup on each check

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

/**
 * Get combined rate limit headers for both token and IP buckets
 * Exposes both limits so clients can react to either bucket nearing exhaustion
 */
export function getRateLimitHeadersCombined(
  token:
    | { limit: number; remaining: number; resetAt: number }
    | null
    | undefined,
  ip: { limit: number; remaining: number; resetAt: number }
): Record<string, string> {
  const h: Record<string, string> = {};

  // Individual bucket headers
  if (token) {
    h["X-RateLimit-Limit-Token"] = String(token.limit);
    h["X-RateLimit-Remaining-Token"] = String(token.remaining);
    h["X-RateLimit-Reset-Token"] = new Date(token.resetAt).toISOString();
  }
  if (ip) {
    h["X-RateLimit-Limit-IP"] = String(ip.limit);
    h["X-RateLimit-Remaining-IP"] = String(ip.remaining);
    h["X-RateLimit-Reset-IP"] = new Date(ip.resetAt).toISOString();
  }

  // Combined view (most restrictive limits)
  const limits = [token, ip].filter(Boolean) as Array<{
    remaining: number;
    resetAt: number;
    limit: number;
  }>;
  if (limits.length) {
    h["X-RateLimit-Limit"] = String(Math.max(...limits.map((x) => x.limit)));
    h["X-RateLimit-Remaining"] = String(
      Math.min(...limits.map((x) => x.remaining))
    );
    h["X-RateLimit-Reset"] = new Date(
      Math.min(...limits.map((x) => x.resetAt))
    ).toISOString();
  }

  return h;
}
