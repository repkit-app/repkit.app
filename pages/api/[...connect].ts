/**
 * Connect RPC Router (Pages Router)
 * Registers all ChatService RPC endpoints with authentication, rate limiting, and logging
 *
 * This implementation uses Next.js Pages Router API routes, which is the router
 * supported by @connectrpc/connect-next for optimal compatibility.
 *
 * Endpoints:
 * - POST /api/repkit.ai.v1.ChatService/CreateStandardCompletion (unary)
 * - POST /api/repkit.ai.v1.ChatService/CreateMiniCompletion (unary)
 * - POST /api/repkit.ai.v1.ChatService/StreamStandardCompletion (streaming)
 *
 * Interceptor Order:
 * 1. auth - Validate HMAC signature and timestamp
 * 2. rateLimit - Check dual-bucket rate limits
 * 3. logging - Log request metrics and errors
 * 4. handlers - Execute RPC methods
 *
 * Response Headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - X-Request-Id (for tracing)
 */

import type { NextApiHandler } from 'next';
import { nextJsApiRouter } from '@connectrpc/connect-next';
import { authInterceptor } from '@/lib/interceptors/auth';
import { rateLimitInterceptor } from '@/lib/interceptors/rate-limit';
import { loggingInterceptor } from '@/lib/interceptors/logging';
import { registerChatServiceHandlers } from '@/lib/handlers/chat-service';

const { handler: connectHandler, config: connectConfig } = nextJsApiRouter({
  routes: (router) => {
    // Register ChatService handlers
    registerChatServiceHandlers(router);
  },
  interceptors: [
    // Authentication must run first
    authInterceptor,
    // Rate limiting after auth (don't limit unauthenticated requests)
    rateLimitInterceptor,
    // Logging wraps everything for observability
    loggingInterceptor,
  ],
});

const handler: NextApiHandler = connectHandler as NextApiHandler;

export default handler;

// Pages Router requires config to be a literal object, not a variable
export const config = {
  api: {
    bodyParser: false, // Connect handles the body
  },
};
