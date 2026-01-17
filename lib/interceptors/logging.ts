/**
 * Logging Interceptor
 * Captures request metrics and integrates with Sentry for error tracking
 */

import type { Interceptor } from '@connectrpc/connect';
import * as Sentry from '@sentry/nextjs';
import { calculateCost } from '@/lib/openai';
import { anonymize } from '@/lib/utils/anonymize';
import { logger } from '@/lib/utils/logger';

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

    // Extract identifiers for logging (from request message and headers)
    const msg = req.message as any;
    const deviceToken = typeof msg['deviceToken'] === 'string' ? msg['deviceToken'] : undefined;

    // Extract client IP from request headers
    // Priority: Cloudflare Edge IP > Real IP > First X-Forwarded-For > fallback
    const headers = req.header;
    const cfIp = headers.get('cf-connecting-ip')?.trim();
    const realIp = headers.get('x-real-ip')?.trim();
    const xff = headers.get('x-forwarded-for') || '';
    const xffFirst = xff.split(',')[0]?.trim();
    const ip = cfIp || realIp || xffFirst || 'unknown';

    const identifier = deviceToken
      ? `token#${anonymize(deviceToken)}`
      : `ip#${anonymize(ip)}`;

    // Extract request details
    const method = req.method.name;
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
            method.includes('Mini') ? 'gpt-4o-mini' : 'gpt-5.2',
            usage.promptTokens || 0,
            usage.completionTokens || 0,
            cachedTokens
          );

          logger.info('API Request completed', {
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
          logger.info('API Request completed', {
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
        logger.info('API Request streaming', {
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
      logger.error('API Request failed', error instanceof Error ? error : null, {
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
