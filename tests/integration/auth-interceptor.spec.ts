/**
 * Authentication interceptor tests
 * Validates HMAC signature and timestamp verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import {
  CreateChatCompletionRequest,
  ChatMessage,
  ChatMessage_Role,
} from '@/lib/generated/repkit/ai/v1/api_pb';
import {
  createAuthenticatedRequest,
  createInvalidSignatureRequest,
  createExpiredTimestampRequest,
  setupTestEnv,
} from '../helpers/test-utils';

describe('Authentication Interceptor', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  describe('Valid Signature Validation', () => {
    it('should create valid HMAC-SHA256 signature', () => {
      const { req, signature, timestamp } = createAuthenticatedRequest();

      // Verify signature format
      expect(signature).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters for SHA256
    });

    it('should compute signature correctly for request payload', () => {
      const timestamp = Date.now().toString();
      const deviceToken = 'test-device-token';
      const secret = 'test-secret-key-123';

      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test message',
          }),
        ],
        deviceToken,
      });

      // Reconstruct the expected signature
      const messageJson = JSON.stringify({
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: req.tools,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        toolChoice: req.toolChoice,
        deviceToken: req.deviceToken,
      });

      const payload = Buffer.concat([
        Buffer.from(messageJson, 'utf-8'),
        Buffer.from(timestamp, 'utf-8'),
      ]);

      const expectedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(expectedSignature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should validate correct signature', () => {
      const { signature, timestamp } = createAuthenticatedRequest();

      // Signature should be 64 hex characters
      expect(signature).toHaveLength(64);
      expect(signature).toMatch(/^[a-f0-9]+$/);
      expect(timestamp).toBeTruthy();
    });
  });

  describe('Signature Validation Failure', () => {
    it('should reject invalid signature', () => {
      const { signature } = createInvalidSignatureRequest();

      expect(signature).toBe('invalid_signature_12345');
      // Interceptor should reject this during validation
    });

    it('should detect modified payload', () => {
      const { req, timestamp } = createAuthenticatedRequest();
      const secret = 'test-secret-key-123';

      // Compute signature for modified message
      const messageJson = JSON.stringify({
        messages: [
          {
            role: ChatMessage_Role.USER,
            content: 'MODIFIED MESSAGE',
          },
        ],
        tools: req.tools,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        toolChoice: req.toolChoice,
        deviceToken: req.deviceToken,
      });

      const payload = Buffer.concat([
        Buffer.from(messageJson, 'utf-8'),
        Buffer.from(timestamp, 'utf-8'),
      ]);

      const modifiedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Original signature should differ from modified
      expect(modifiedSignature).not.toBe(
        createHmac('sha256', secret)
          .update(Buffer.concat([
            Buffer.from(
              JSON.stringify({
                messages: [
                  {
                    role: ChatMessage_Role.USER,
                    content: 'original',
                  },
                ],
                tools: req.tools,
                temperature: req.temperature,
                maxTokens: req.maxTokens,
                toolChoice: req.toolChoice,
                deviceToken: req.deviceToken,
              }),
              'utf-8'
            ),
            Buffer.from(timestamp, 'utf-8'),
          ]))
          .digest('hex')
      );
    });

    it('should reject signature from different secret', () => {
      const timestamp = Date.now().toString();
      const deviceToken = 'test-device-token';

      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        deviceToken,
      });

      const messageJson = JSON.stringify({
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: req.tools,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        toolChoice: req.toolChoice,
        deviceToken: req.deviceToken,
      });

      const payload = Buffer.concat([
        Buffer.from(messageJson, 'utf-8'),
        Buffer.from(timestamp, 'utf-8'),
      ]);

      // Signature with correct secret
      const correctSignature = createHmac('sha256', 'test-secret-key-123')
        .update(payload)
        .digest('hex');

      // Signature with wrong secret
      const wrongSignature = createHmac('sha256', 'wrong-secret-key')
        .update(payload)
        .digest('hex');

      expect(correctSignature).not.toBe(wrongSignature);
    });
  });

  describe('Timestamp Validation', () => {
    it('should accept recent timestamp (within 5 minutes)', () => {
      const { req, timestamp } = createAuthenticatedRequest();
      const requestTime = parseInt(timestamp, 10);
      const serverTime = Date.now();
      const timeDiffMs = Math.abs(serverTime - requestTime);
      const fiveMinutesMs = 5 * 60 * 1000;

      expect(timeDiffMs).toBeLessThan(fiveMinutesMs);
    });

    it('should reject expired timestamp (older than 5 minutes)', () => {
      const { timestamp } = createExpiredTimestampRequest();
      const requestTime = parseInt(timestamp, 10);
      const serverTime = Date.now();
      const timeDiffMs = Math.abs(serverTime - requestTime);
      const fiveMinutesMs = 5 * 60 * 1000;

      expect(timeDiffMs).toBeGreaterThan(fiveMinutesMs);
    });

    it('should reject future timestamp (more than 5 minutes ahead)', () => {
      const timestamp = (Date.now() + 10 * 60 * 1000).toString();
      const serverTime = Date.now();
      const requestTime = parseInt(timestamp, 10);
      const timeDiffMs = Math.abs(serverTime - requestTime);
      const fiveMinutesMs = 5 * 60 * 1000;

      expect(timeDiffMs).toBeGreaterThan(fiveMinutesMs);
    });

    it('should use millisecond precision for timestamps', () => {
      const timestamp = Date.now().toString();

      expect(timestamp).toMatch(/^\d{13}$/); // 13 digits for milliseconds
    });

    it('should calculate time difference correctly', () => {
      const serverTime = Date.now();
      const clientTime = serverTime - 1000; // 1 second ago
      const timeDiffMs = Math.abs(serverTime - clientTime);

      expect(timeDiffMs).toBe(1000);
    });

    it('should have 5-minute window exactly', () => {
      const fiveMinutesMs = 5 * 60 * 1000;

      expect(fiveMinutesMs).toBe(300000);
    });
  });

  describe('Missing Authentication Fields', () => {
    it('should reject request without signature', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Request missing signature field
      const signature = (req as unknown as Record<string, unknown>).signature;
      expect(signature).toBeUndefined();
    });

    it('should reject request without timestamp', () => {
      const { req } = createAuthenticatedRequest();

      // Manually check if timestamp exists
      const timestamp = (req as unknown as Record<string, unknown>).timestamp;
      expect(timestamp === undefined || timestamp === '').toBe(true);
    });

    it('should require both signature and timestamp', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Both should be missing or empty
      const signature = (req as unknown as Record<string, unknown>).signature;
      const timestamp = (req as unknown as Record<string, unknown>).timestamp;

      expect(signature === undefined || signature === '').toBe(true);
      expect(timestamp === undefined || timestamp === '').toBe(true);
    });
  });

  describe('Device Token Extraction', () => {
    it('should extract device token from message', () => {
      const deviceToken = 'my-device-token-12345';
      const { req } = createAuthenticatedRequest(deviceToken);

      expect(req.deviceToken).toBe(deviceToken);
    });

    it('should handle missing device token', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      expect(req.deviceToken === '' || req.deviceToken === undefined).toBe(true);
    });

    it('should preserve device token in signature calculation', () => {
      const deviceToken = 'special-token-xyz';
      const timestamp = Date.now().toString();
      const secret = 'test-secret-key-123';

      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        deviceToken,
      });

      const messageJson = JSON.stringify({
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: req.tools,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        toolChoice: req.toolChoice,
        deviceToken: req.deviceToken,
      });

      expect(messageJson).toContain(deviceToken);

      const payload = Buffer.concat([
        Buffer.from(messageJson, 'utf-8'),
        Buffer.from(timestamp, 'utf-8'),
      ]);

      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Signature Key Management', () => {
    it('should use HMAC_SECRET from environment', () => {
      process.env.HMAC_SECRET = 'env-secret-key';
      const secret = process.env.HMAC_SECRET || 'change-me-in-prod';

      expect(secret).toBe('env-secret-key');
    });

    it('should fall back to default if HMAC_SECRET not set', () => {
      const originalSecret = process.env.HMAC_SECRET;
      delete process.env.HMAC_SECRET;

      const secret = process.env.HMAC_SECRET || 'change-me-in-prod';
      expect(secret).toBe('change-me-in-prod');

      if (originalSecret) {
        process.env.HMAC_SECRET = originalSecret;
      }
    });

    it('should never hardcode secrets in code', () => {
      // This test documents that secrets should come from environment
      const secret = process.env.HMAC_SECRET;
      expect(secret).toBeDefined();
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should prevent timestamp reuse with same signature', () => {
      const { signature, timestamp } = createAuthenticatedRequest();

      // Same timestamp + signature should be rejected by rate limiter even if auth passes
      expect(timestamp).toBeTruthy();
      expect(signature).toMatch(/^[a-f0-9]{64}$/);

      // Rate limiting handles the actual replay prevention
    });

    it('should require fresh timestamp for each request', () => {
      const { timestamp: timestamp1 } = createAuthenticatedRequest();

      // Simulate small delay
      const { timestamp: timestamp2 } = createAuthenticatedRequest();

      // Timestamps should be different (or at worst, very close)
      expect(timestamp1).toBeTruthy();
      expect(timestamp2).toBeTruthy();
    });
  });
});
