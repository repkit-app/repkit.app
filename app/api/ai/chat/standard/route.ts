import { NextRequest, NextResponse } from "next/server";
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

/**
 * OpenAI API Proxy - Standard Model (gpt-4o)
 * Endpoint: POST /api/ai/chat/standard
 *
 * Purpose: Proxy requests to OpenAI's Chat Completions API
 * using the more capable gpt-4o model for complex queries.
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

    // Check rate limits (require BOTH token and IP to be within limits)
    // This prevents bypassing limits by rotating X-Device-Token
    const tokenRate = deviceToken ? checkRateLimit(deviceToken, true) : null;
    const ipRate = checkRateLimit(ip, false);
    const violated = tokenRate && !tokenRate.allowed ? tokenRate : !ipRate.allowed ? ipRate : null;
    const effective = tokenRate ?? ipRate;

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

    // Parse and validate request body
    let body: ChatCompletionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
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
    const completion = await createChatCompletion("gpt-4o", body);

    // Calculate cost
    const usage = completion.usage;
    const cost = usage
      ? calculateCost("gpt-4o", usage.prompt_tokens, usage.completion_tokens)
      : 0;

    // Log request details
    const duration = Date.now() - startTime;
    console.log("[API Request]", {
      requestId,
      model: "gpt-4o",
      identifier: deviceToken
        ? `token#${anonymize(deviceToken)}`
        : `ip#${anonymize(ip)}`,
      userAgent: request.headers.get("user-agent") || "unknown",
      messages: body.messages.length,
      promptTokens: usage?.prompt_tokens || 0,
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
      model: "gpt-4o",
      error: errorMessage,
      type: errorType,
      duration: `${duration}ms`,
    });

    // Handle OpenAI API errors
    const hasStatus = typeof error === "object" && error !== null && "status" in error;
    if (hasStatus) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      const errorStatus =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status?: number }).status
          : 500;

      // OpenAI API error (rate limit, invalid request, etc.)
      return NextResponse.json(
        {
          error: "OpenAI API error",
          message: "An error occurred while processing your request. Please try again.",
          code: errorCode || "unknown",
        },
        { status: errorStatus === 429 ? 503 : 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
