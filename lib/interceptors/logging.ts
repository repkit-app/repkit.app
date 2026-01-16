/**
 * Logging Interceptor
 * Captures request metrics and integrates with Sentry for error tracking
 */

import type { Interceptor } from '@connectrpc/connect';
import * as Sentry from '@sentry/nextjs';
import { calculateCost } from '@/lib/openai';

/**
 * Anonymize PII for logging
 */
function anonymize(value: string): string {
  const crypto = require('crypto');
  const key = process.env.LOG_HASH_KEY || 'change-me-in-prod';
  return value
    ? crypto.createHmac('sha256', key).update(value).digest('hex').slice(0, 12)
    : 'unknown';
}

/**
 * Logging Interceptor
 * Logs all requests with metrics and captures errors with Sentry
 *
 * Metrics captured:
 * - Request ID (UUID for tracing)
 * - Method name (RPC method being called)
 * - Message counts (messages, tools)
 * - Latency (duration in ms)
 * - Token usage (from OpenAI response)
 * - Cost (calculated from token usage)
 *
 * Error handling:
 * - Captures OpenAI errors with fingerprinting by error type
 * - Excludes sensitive data (messages, signatures, device tokens)
 * - Includes anonymized identifiers for debugging
 */
export const loggingInterceptor: Interceptor = (next) => {
  return async (req) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    // Extract identifiers for logging (from rate limit interceptor)
    const deviceToken = (req as any)._deviceToken as string | undefined;
    const ip = (req as any)._ip as string || 'unknown';
    const identifier = deviceToken
      ? `token#${anonymize(deviceToken)}`
      : `ip#${anonymize(ip)}`;

    // Extract request details
    const method = req.method.name;
    const msg = req.message as any;
    const messages = (msg.messages || []).length;
    const tools = (msg.tools || []).length;

    try {
      const response = await next(req);

      // Log successful request
      const duration = Date.now() - startTime;

      if ('message' in response && !response.stream) {
        // Unary response - has usage metadata
        const message = response.message as any;
        const usage = message.usage;

        if (usage) {
          const cachedTokens = usage.promptTokensDetails?.cachedTokens || 0;
          const cost = calculateCost(
            method.includes('Mini') ? 'gpt-4o-mini' : 'gpt-5-mini',
            usage.promptTokens || 0,
            usage.completionTokens || 0,
            cachedTokens
          );

          console.log('[API Request]', {
            requestId,
            method,
            identifier,
            userAgent: req.header.get('user-agent') || 'unknown',
            messages,
            tools,
            promptTokens: usage.promptTokens || 0,
            cachedTokens,
            completionTokens: usage.completionTokens || 0,
            totalTokens: usage.totalTokens || 0,
            cost: `$${cost.toFixed(6)}`,
            duration: `${duration}ms`,
          });
        } else {
          console.log('[API Request]', {
            requestId,
            method,
            identifier,
            userAgent: req.header.get('user-agent') || 'unknown',
            messages,
            tools,
            duration: `${duration}ms`,
          });
        }
      } else {
        // Streaming response
        console.log('[API Request] Streaming', {
          requestId,
          method,
          identifier,
          userAgent: req.header.get('user-agent') || 'unknown',
          messages,
          tools,
          duration: `${duration}ms`,
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorType =
        error instanceof Error ? error.constructor.name : 'Unknown';

      // Log error
      console.error('[API Error]', {
        requestId,
        method,
        identifier,
        error: errorMessage,
        type: errorType,
        duration: `${duration}ms`,
      });

      // Capture error in Sentry (with sanitization)
      Sentry.captureException(error, {
        tags: {
          endpoint: method,
          error_type: errorType,
        },
        extra: {
          requestId,
          duration_ms: duration,
          messages,
          tools,
          // DO NOT include: deviceToken, ip, signature, request content
        },
        fingerprint: ['api-error', method, errorType],
      });

      // Re-throw to let Connect error handling take over
      throw error;
    }
  };
};
