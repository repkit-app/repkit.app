import { NextRequest, NextResponse } from "next/server";
import {
  createChatCompletion,
  calculateCost,
  type ChatCompletionRequest,
} from "@/lib/openai";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

/**
 * OpenAI API Proxy - Mini Model (gpt-4o-mini)
 * Endpoint: POST /api/ai/chat/mini
 *
 * Purpose: Proxy requests to OpenAI's Chat Completions API
 * using the cost-effective gpt-4o-mini model.
 *
 * Rate Limits:
 * - 100 requests/hour with X-Device-Token header
 * - 50 requests/hour without token (fallback to IP)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Extract identifier for rate limiting
    const deviceToken = request.headers.get("X-Device-Token");
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const identifier = deviceToken || ip;

    // Check rate limit
    const rateLimit = checkRateLimit(identifier, !!deviceToken);

    if (!rateLimit.allowed) {
      console.warn("[Rate Limit] Exceeded:", {
        identifier: deviceToken ? `token:${deviceToken.slice(0, 8)}...` : `ip:${ip}`,
        limit: rateLimit.limit,
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `You have exceeded the rate limit of ${rateLimit.limit} requests per hour. Please try again later.`,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // Parse and validate request body
    const body: ChatCompletionRequest = await request.json();

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
    const completion = await createChatCompletion("gpt-4o-mini", body);

    // Calculate cost
    const usage = completion.usage;
    const cost = usage
      ? calculateCost(
          "gpt-4o-mini",
          usage.prompt_tokens,
          usage.completion_tokens
        )
      : 0;

    // Log request details
    const duration = Date.now() - startTime;
    console.log("[API Request]", {
      model: "gpt-4o-mini",
      identifier: deviceToken ? `token:${deviceToken.slice(0, 8)}...` : `ip:${ip}`,
      userAgent: request.headers.get("user-agent") || "unknown",
      messages: body.messages.length,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      cost: `$${cost.toFixed(6)}`,
      duration: `${duration}ms`,
    });

    // Return completion with rate limit headers
    return NextResponse.json(completion, {
      headers: getRateLimitHeaders(rateLimit),
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
      model: "gpt-4o-mini",
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
