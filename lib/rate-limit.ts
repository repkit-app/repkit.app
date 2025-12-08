import { Redis } from "@upstash/redis";

/**
 * In-memory rate limiter with optional shared backend (Upstash Redis).
 * Tracks requests per identifier (device token or IP address).
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are provided,
 * rate limits are enforced per-instance + shared Redis. Otherwise, the
 * limiter falls back to single-instance memory.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
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

const redisClient = createRedisClient();

function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("[Rate Limit] Failed to initialize Redis, using in-memory store", {
      error,
    });
    return null;
  }
}

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
 * Check if a request is allowed under rate limits.
 * Uses Redis if configured, otherwise falls back to in-memory store.
 *
 * @param identifier - Device token or IP address
 * @param hasDeviceToken - Whether the request includes a device token
 * @returns Object with allowed status and limit info
 */
export async function checkRateLimit(
  identifier: string,
  hasDeviceToken: boolean
): Promise<RateLimitInfo> {
  const now = Date.now();
  const limit = hasDeviceToken
    ? RATE_LIMITS.WITH_TOKEN
    : RATE_LIMITS.WITHOUT_TOKEN;

  if (!redisClient) {
    return checkRateLimitMemory(identifier, limit, now);
  }

  return checkRateLimitRedis(redisClient, identifier, limit, now);
}

async function checkRateLimitMemory(
  identifier: string,
  limit: number,
  now: number
): Promise<RateLimitInfo> {
  cleanupExpired(now); // Lazy cleanup on each check

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

async function checkRateLimitRedis(
  client: Redis,
  identifier: string,
  limit: number,
  now: number
): Promise<RateLimitInfo> {
  const windowStart = Math.floor(now / RATE_LIMITS.WINDOW_MS);
  const key = `ratelimit:${identifier}:${windowStart}`;

  try {
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.pexpire(key, RATE_LIMITS.WINDOW_MS);
    pipeline.pttl(key);
    const [incrResult, , ttlResult] = await pipeline.exec();

    const count = Number((incrResult as { result?: number } | null)?.result ?? 0);
    const ttlMsRaw = (ttlResult as { result?: number } | null)?.result;
    const ttlMs =
      typeof ttlMsRaw === "number" && ttlMsRaw > 0
        ? ttlMsRaw
        : RATE_LIMITS.WINDOW_MS;
    const resetAt = now + ttlMs;

    if (count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch (error) {
    console.error("[Rate Limit] Redis error, using in-memory fallback", {
      error,
    });
    return checkRateLimitMemory(identifier, limit, now);
  }
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
