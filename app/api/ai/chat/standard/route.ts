import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { createHmac } from "crypto";
import {
  createChatCompletion,
  calculateCost,
  type ChatCompletionRequest,
} from "@/lib/openai";
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRateLimitHeadersCombined,
} from "@/lib/rate-limit";

/**
 * Anonymize PII for logging using HMAC
 * Prevents offline reversal of hashed IPs/tokens from leaked logs
 */
function anonymize(value: string): string {
  const key = process.env.LOG_HASH_KEY || "change-me-in-prod";
  return value
    ? createHmac("sha256", key).update(value).digest("hex").slice(0, 12)
    : "unknown";
}

function hasErrorCode(
  error: unknown
): error is { code?: string | number } {
  return typeof error === "object" && error !== null && "code" in error;
}

function hasErrorStatus(error: unknown): error is { status?: number } {
  return typeof error === "object" && error !== null && "status" in error;
}

function isChatCompletionResult(
  result: unknown
): result is ChatCompletion & {
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens?: number | null };
  };
} {
  if (!hasUsage(result)) return false;
  const usage = result.usage;
  return (
    typeof usage === "object" &&
    usage !== null &&
    "prompt_tokens" in usage &&
    "completion_tokens" in usage &&
    "total_tokens" in usage
  );
}

function hasUsage(result: unknown): result is { usage: unknown } {
  return typeof result === "object" && result !== null && "usage" in result;
}

/**
 * OpenAI API Proxy - Standard Model (gpt-5.2)
 * Endpoint: POST /api/ai/chat/standard
 *
 * Purpose: Proxy requests to OpenAI's Chat Completions API
 * using GPT-5.2 for agentic tasks and complex tool calling.
 *
 * Rate Limits:
 * - 100 requests/hour with X-Device-Token header
 * - 50 requests/hour without token (fallback to IP)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  try {
    // Extract device token and client IP for rate limiting
    const deviceToken =
      request.headers.get("x-device-token")?.trim() || undefined;
    // Prefer cf-connecting-ip (Cloudflare edge), then x-real-ip, then first x-forwarded-for hop
    const cfIp = request.headers.get("cf-connecting-ip")?.trim();
    const realIp = request.headers.get("x-real-ip")?.trim();
    const xff = request.headers.get("x-forwarded-for") || "";
    const xffFirst = xff.split(",")[0]?.trim();
    const ip = cfIp || realIp || xffFirst || "0.0.0.0";

    // Get raw body text BEFORE parsing (needed for HMAC signature validation)
    // CRITICAL: We must use the original request body text for signature validation
    // because JSON.stringify(body) produces different output than Swift's JSONEncoder
    let bodyText: string;
    let body: ChatCompletionRequest;
    try {
      bodyText = await request.text();
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // HMAC Authentication: Validate request signature
    const signature = request.headers.get("x-request-signature")?.trim();
    const timestamp = request.headers.get("x-request-timestamp")?.trim();

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    // Validate timestamp (5 minute window to prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    const age = now - requestTime * 1000;

    if (isNaN(requestTime) || age < 0 || age > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Request timestamp invalid or expired" },
        { status: 401 }
      );
    }

    // Validate HMAC signature
    const secret = process.env.HMAC_SECRET;

    if (!secret) {
      console.error("[Auth] HMAC_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Use the original body text for signature validation (not re-serialized)
    const payload = bodyText + timestamp;
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("[Auth] Invalid signature:", {
        requestId,
        identifier: deviceToken
          ? `token#${anonymize(deviceToken)}`
          : `ip#${anonymize(ip)}`,
      });

      return NextResponse.json(
        { error: "Invalid request signature" },
        { status: 401 }
      );
    }

    // Check rate limits (require BOTH token and IP to be within limits)
    // This prevents bypassing limits by rotating X-Device-Token
    const tokenRate = deviceToken ? await checkRateLimit(deviceToken, true) : null;
    const ipRate = await checkRateLimit(ip, false);
    const violated = tokenRate && !tokenRate.allowed ? tokenRate : !ipRate.allowed ? ipRate : null;

    if (violated) {
      console.warn("[Rate Limit] Exceeded:", {
        identifier: deviceToken
          ? `token#${anonymize(deviceToken)}`
          : `ip#${anonymize(ip)}`,
        limit: violated.limit,
      });
      const retryAfter = Math.max(
        0,
        Math.ceil((violated.resetAt - Date.now()) / 1000)
      ).toString();
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `You have exceeded the rate limit of ${violated.limit} requests per hour. Please try again later.`,
          resetAt: new Date(violated.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: { ...getRateLimitHeaders(violated), "Retry-After": retryAfter },
        }
      );
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array is required" },
        { status: 400 }
      );
    }

    if (body.messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: messages array cannot be empty" },
        { status: 400 }
      );
    }

    // Call OpenAI API
    const completion = await createChatCompletion("gpt-5.2", body);
    if (!isChatCompletionResult(completion)) {
      return NextResponse.json(
        { error: "OpenAI API error", message: "Unexpected response shape." },
        { status: 502 }
      );
    }

    // Calculate cost (accounting for cached input tokens at reduced rate)
    const usage = completion.usage;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const cost = usage
      ? calculateCost(
          "gpt-5.2",
          usage.prompt_tokens,
          usage.completion_tokens,
          cachedTokens
        )
      : 0;

    // Log request details
    const duration = Date.now() - startTime;
    console.log("[API Request]", {
      requestId,
      model: "gpt-5.2",
      identifier: deviceToken
        ? `token#${anonymize(deviceToken)}`
        : `ip#${anonymize(ip)}`,
      userAgent: request.headers.get("user-agent") || "unknown",
      messages: body.messages.length,
      promptTokens: usage?.prompt_tokens || 0,
      cachedTokens,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      cost: `$${cost.toFixed(6)}`,
      duration: `${duration}ms`,
    });

    // Return completion with rate limit headers and request ID
    return NextResponse.json(completion, {
      headers: {
        "X-Request-Id": requestId,
        ...getRateLimitHeadersCombined(tokenRate ?? undefined, ipRate),
      },
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    // Type guard for error with message
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorType =
      error instanceof Error ? error.constructor.name : "Unknown";

    // Log error details
    console.error("[API Error]", {
      requestId,
      model: "gpt-5.2",
      error: errorMessage,
      type: errorType,
      duration: `${duration}ms`,
    });

    // Handle OpenAI API errors - preserve original status and message
    const hasStatus = typeof error === "object" && error !== null && "status" in error;
    if (hasStatus) {
      const errorCode =
        hasErrorCode(error) && typeof error.code === "string"
          ? error.code
          : undefined;
      const errorStatus =
        hasErrorStatus(error) && typeof error.status === "number"
          ? error.status
          : 500;

      // Preserve original error message for debugging
      // 4xx errors are client errors (don't retry), 5xx and 429 may be retried
      const isClientError = errorStatus >= 400 && errorStatus < 500 && errorStatus !== 429;

      return NextResponse.json(
        {
          error: "OpenAI API error",
          message: errorMessage,
          code: errorCode || "unknown",
          retryable: !isClientError,
        },
        {
          status: errorStatus === 429 ? 503 : errorStatus,
          headers: {
            "X-Request-Id": requestId,
          },
        }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500, headers: { "X-Request-Id": requestId } }
    );
  }
}
