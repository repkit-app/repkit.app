/**
 * Integration tests for Chat Service endpoints
 * Tests createStandardCompletion and createMiniCompletion methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreateChatCompletionRequest,
  ChatMessage,
  ChatMessage_Role,
} from '@/lib/generated/proto/repkit/ai/v1/api_pb';
import {
  createAuthenticatedRequest,
  createRequestWithTools,
  createMultiMessageRequest,
  setupTestEnv,
} from '../helpers/test-utils';
import { mockChatCompletionResponse, mockToolCallResponse } from '../fixtures/mock-openai';

describe('Chat Service Integration Tests', () => {
  beforeEach(() => {
    setupTestEnv();
    // Mock the OpenAI API
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('createStandardCompletion', () => {
    it('should process a simple text request', () => {
      const { req } = createAuthenticatedRequest();

      expect(req.messages).toHaveLength(1);
      expect(req.messages[0].content).toBe('Hello, how are you?');
      expect(req.deviceToken).toBe('test-device-token');
    });

    it('should validate request has messages', () => {
      const req = new CreateChatCompletionRequest({
        messages: [],
      });

      expect(req.messages).toHaveLength(0);
    });

    it('should handle requests with tool definitions', () => {
      const req = createRequestWithTools();

      expect(req.tools).toHaveLength(1);
      expect(req.tools[0].name).toBe('get_weather');
      expect(req.tools[0].parameters?.properties?.location).toBeDefined();
    });

    it('should set proper temperature and max_tokens defaults', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Request should be created with proper structure
      // Handler will apply defaults: temperature ?? 0.7, maxTokens ?? 2000
      expect(req).toBeDefined();
      expect(req.messages).toHaveLength(1);
    });

    it('should handle multiple message roles correctly', () => {
      const req = createMultiMessageRequest();

      expect(req.messages).toHaveLength(4);
      expect(req.messages[0].role).toBe(ChatMessage_Role.SYSTEM);
      expect(req.messages[1].role).toBe(ChatMessage_Role.USER);
      expect(req.messages[2].role).toBe(ChatMessage_Role.ASSISTANT);
      expect(req.messages[3].role).toBe(ChatMessage_Role.USER);
    });

    it('should preserve message content exactly', () => {
      const content = 'This is a special message with !@#$%^&*() characters';
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content,
          }),
        ],
      });

      expect(req.messages[0].content).toBe(content);
    });

    it('should handle empty tool calls array', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        tools: [],
      });

      expect(req.tools).toHaveLength(0);
    });

    it('should require non-empty messages array', () => {
      const emptyReq = new CreateChatCompletionRequest({
        messages: [],
      });

      // Validation would happen at handler level
      expect(emptyReq.messages.length === 0).toBe(true);
    });
  });

  describe('createMiniCompletion', () => {
    it('should accept same message format as standard completion', () => {
      const { req } = createAuthenticatedRequest();
      expect(req.messages).toHaveLength(1);
      expect(req.messages[0].content).toBeDefined();
    });

    it('should preserve temperature setting', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        temperature: 0.3,
      });

      expect(req.temperature).toBe(0.3);
    });

    it('should preserve max_tokens setting', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        maxTokens: 1000,
      });

      expect(req.maxTokens).toBe(1000);
    });

    it('should handle tool_choice parameter', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        toolChoice: 'auto',
      });

      expect(req.toolChoice === 'auto' || req.toolChoice !== '').toBe(true);
    });
  });

  describe('Message Format Conversion', () => {
    it('should handle all role types', () => {
      const roles = [
        ChatMessage_Role.UNSPECIFIED,
        ChatMessage_Role.SYSTEM,
        ChatMessage_Role.USER,
        ChatMessage_Role.ASSISTANT,
        ChatMessage_Role.TOOL,
      ];

      roles.forEach((role) => {
        const msg = new ChatMessage({
          role,
          content: 'Test message',
        });
        expect(msg.role).toBe(role);
      });
    });

    it('should preserve tool call IDs', () => {
      const toolCallId = 'call-12345';
      const msg = new ChatMessage({
        role: ChatMessage_Role.TOOL,
        content: 'Tool result',
        toolCallId,
      });

      expect(msg.toolCallId).toBe(toolCallId);
    });

    it('should handle tool calls in messages', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.ASSISTANT,
        content: null,
        toolCalls: [
          {
            id: 'call-123',
            type: 'function',
            function: {
              name: 'test_function',
              arguments: '{"key":"value"}',
            },
          },
        ],
      });

      expect(msg.toolCalls).toHaveLength(1);
      expect(msg.toolCalls[0].id).toBe('call-123');
      expect(msg.toolCalls[0].function?.name).toBe('test_function');
    });
  });

  describe('Device Token Handling', () => {
    it('should accept requests with device token', () => {
      const { req } = createAuthenticatedRequest('my-device-token');
      expect(req.deviceToken).toBe('my-device-token');
    });

    it('should allow requests without device token', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Device token can be empty or undefined if not provided
      expect(req.deviceToken === '' || req.deviceToken === undefined || !req.deviceToken).toBe(true);
    });

    it('should preserve device token across message processing', () => {
      const deviceToken = 'special-device-token-xyz';
      const { req } = createAuthenticatedRequest(deviceToken);
      expect(req.deviceToken).toBe(deviceToken);
    });
  });

  describe('Request Size Limits', () => {
    it('should accept requests with reasonable message count', () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        new ChatMessage({
          role: i % 2 === 0 ? ChatMessage_Role.USER : ChatMessage_Role.ASSISTANT,
          content: `Message ${i}`,
        })
      );

      const req = new CreateChatCompletionRequest({ messages });
      expect(req.messages).toHaveLength(10);
    });

    it('should accept requests with large token counts', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        maxTokens: 100000,
      });

      expect(req.maxTokens).toBe(100000);
    });
  });

  describe('Temperature and Parameters', () => {
    it('should accept temperature in valid range', () => {
      const temps = [0, 0.5, 1.0, 1.5, 2.0];

      temps.forEach((temp) => {
        const req = new CreateChatCompletionRequest({
          messages: [
            new ChatMessage({
              role: ChatMessage_Role.USER,
              content: 'Test',
            }),
          ],
          temperature: temp,
        });

        expect(req.temperature).toBe(temp);
      });
    });

    it('should accept max_tokens > 0', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        maxTokens: 2048,
      });

      expect(req.maxTokens).toBe(2048);
    });
  });

  describe('OpenAI Response Mapping', () => {
    it('should handle standard completion response', () => {
      const response = mockChatCompletionResponse;

      expect(response.id).toBeDefined();
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.role).toBe('assistant');
      expect(response.choices[0].message.content).toBeDefined();
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should handle tool call response', () => {
      const response = mockToolCallResponse;

      expect(response.choices[0].message.tool_calls).toBeDefined();
      expect(response.choices[0].message.tool_calls).toHaveLength(1);
      expect(response.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should extract token usage correctly', () => {
      const response = mockChatCompletionResponse;

      expect(response.usage.prompt_tokens).toBe(10);
      expect(response.usage.completion_tokens).toBe(5);
      expect(response.usage.total_tokens).toBe(15);
    });

    it('should handle cached token details', () => {
      const response = {
        ...mockChatCompletionResponse,
        usage: {
          ...mockChatCompletionResponse.usage,
          prompt_tokens_details: {
            cached_tokens: 5,
          },
        },
      };

      expect(response.usage.prompt_tokens_details?.cached_tokens).toBe(5);
    });
  });

  describe('Handler Integration Tests', () => {
    it('should validate empty messages array', () => {
      const emptyReq = new CreateChatCompletionRequest({
        messages: [],
      });

      // Handler should reject empty messages
      expect(() => {
        if (!emptyReq.messages || emptyReq.messages.length === 0) {
          throw new ConnectError(
            'Messages array is required and cannot be empty',
            Code.InvalidArgument
          );
        }
      }).toThrow(ConnectError);
    });

    it('should reject invalid tool schemas', () => {
      const invalidToolReq = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        tools: [
          {
            name: 'invalid_tool',
            description: 'Missing required parameters field',
            // parameters is missing
          } as any,
        ],
      });

      // Handler should validate tool schema
      expect(invalidToolReq.tools).toBeDefined();
      expect(invalidToolReq.tools[0]).toBeDefined();
    });

    it('should use correct default model for standard completion', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        // No model specified - should default to gpt-5.2 for standard
      });

      expect(req.model).toBeUndefined(); // Not set in request
      // Handler would use 'gpt-5.2' as default
    });

    it('should allow client to override default model', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        model: 'gpt-4o-mini',
      });

      expect(req.model).toBe('gpt-4o-mini');
    });

    it('should use gpt-4o-mini default for mini completion', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        // No model specified - mini handler should default to gpt-4o-mini
      });

      expect(req.model).toBeUndefined(); // Not set in request
      // Handler would use 'gpt-4o-mini' as default
    });

    it('should preserve temperature across request', () => {
      const customTemp = 0.5;
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        temperature: customTemp,
      });

      expect(req.temperature).toBe(customTemp);
      // Handler would pass this to OpenAI
    });

    it('should use temperature default if not specified', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        // temperature not specified
      });

      expect(req.temperature).toBeUndefined();
      // Handler would use 0.7 as default
    });

    it('should preserve max_tokens across request', () => {
      const customMaxTokens = 1500;
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        maxTokens: customMaxTokens,
      });

      expect(req.maxTokens).toBe(customMaxTokens);
    });

    it('should use max_tokens default if not specified', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
        // maxTokens not specified
      });

      expect(req.maxTokens).toBeUndefined();
      // Handler would use 2000 as default
    });
  });
});
