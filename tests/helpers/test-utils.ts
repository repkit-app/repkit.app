/**
 * Test utilities for Chat Service integration tests
 */

import { createHmac } from 'crypto';
import {
  CreateChatCompletionRequest,
  ChatMessage,
  ChatMessage_Role,
  Tool,
  ToolSchema,
} from '@/lib/generated/repkit/ai/v1/api_pb';

/**
 * Create a valid signed request with auth fields
 */
export function createAuthenticatedRequest(
  deviceToken: string = 'test-device-token'
): {
  req: CreateChatCompletionRequest;
  signature: string;
  timestamp: string;
} {
  const timestamp = Date.now().toString();
  const secret = process.env.HMAC_SECRET || 'change-me-in-prod';

  const req = new CreateChatCompletionRequest({
    messages: [
      new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'Hello, how are you?',
      }),
    ],
    temperature: 0.7,
    maxTokens: 2000,
    deviceToken,
  });

  // Serialize message to proto binary for signature (matches auth interceptor)
  const messageBytes = req.toBinary();

  const payload = Buffer.concat([
    messageBytes,
    Buffer.from(timestamp, 'utf-8'),
  ]);

  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return { req, signature, timestamp };
}

/**
 * Create a request with invalid signature for auth testing
 */
export function createInvalidSignatureRequest(): {
  req: CreateChatCompletionRequest;
  signature: string;
  timestamp: string;
} {
  const { req, timestamp } = createAuthenticatedRequest();
  const signature = 'invalid_signature_12345';

  return { req, signature, timestamp };
}

/**
 * Create a request with expired timestamp
 */
export function createExpiredTimestampRequest(): {
  req: CreateChatCompletionRequest;
  signature: string;
  timestamp: string;
} {
  // Timestamp from 10 minutes ago
  const timestamp = (Date.now() - 10 * 60 * 1000).toString();
  const deviceToken = 'test-device-token';
  const secret = process.env.HMAC_SECRET || 'change-me-in-prod';

  const req = new CreateChatCompletionRequest({
    messages: [
      new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'Test',
      }),
    ],
    deviceToken,
  });

  // Serialize message to proto binary for signature (matches auth interceptor)
  const messageBytes = req.toBinary();

  const payload = Buffer.concat([
    messageBytes,
    Buffer.from(timestamp, 'utf-8'),
  ]);

  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return { req, signature, timestamp };
}

/**
 * Create a request with tool definitions
 */
export function createRequestWithTools(): CreateChatCompletionRequest {
  return new CreateChatCompletionRequest({
    messages: [
      new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'Get the weather for San Francisco',
      }),
    ],
    tools: [
      new Tool({
        name: 'get_weather',
        description: 'Get the weather for a location',
        parameters: new ToolSchema({
          properties: {
            location: {
              type: 'string',
              description: 'The location to get weather for',
            },
            unit: {
              type: 'string',
              description: 'Temperature unit (celsius or fahrenheit)',
              enum: ['celsius', 'fahrenheit'],
            },
          },
          required: ['location'],
        }),
        strict: true,
      }),
    ],
  });
}

/**
 * Create a request with multiple messages
 */
export function createMultiMessageRequest(): CreateChatCompletionRequest {
  return new CreateChatCompletionRequest({
    messages: [
      new ChatMessage({
        role: ChatMessage_Role.SYSTEM,
        content: 'You are a helpful assistant.',
      }),
      new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'What is the capital of France?',
      }),
      new ChatMessage({
        role: ChatMessage_Role.ASSISTANT,
        content: 'The capital of France is Paris.',
      }),
      new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'And what is its population?',
      }),
    ],
    temperature: 0.5,
    maxTokens: 500,
  });
}

/**
 * Create a request with invalid tool schema
 */
export function createRequestWithInvalidTools(): CreateChatCompletionRequest {
  return new CreateChatCompletionRequest({
    messages: [
      new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'Test',
      }),
    ],
    tools: [
      new Tool({
        name: '', // Empty name - invalid
        description: 'Test tool',
      }),
    ],
  });
}

/**
 * Set up environment variables for testing
 */
export function setupTestEnv(): void {
  process.env.HMAC_SECRET = 'test-secret-key-123';
  process.env.LOG_HASH_KEY = 'test-log-hash-key';
  process.env.OPENAI_API_KEY = 'sk-test-key-123';
}

/**
 * Get current server time (for rate limit testing)
 */
export function getCurrentTimestamp(): string {
  return Date.now().toString();
}
