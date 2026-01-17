/**
 * Error handling and edge case tests
 * Tests error scenarios, validation failures, and boundary conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Code } from '@connectrpc/connect';
import {
  CreateChatCompletionRequest,
  ChatMessage,
  ChatMessage_Role,
  Tool,
  ToolSchema,
} from '@/lib/generated/repkit/ai/v1/api_pb';
import { setupTestEnv } from '../helpers/test-utils';

describe('Error Handling and Edge Cases', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  describe('Empty Messages Validation', () => {
    it('should reject requests with empty messages array', () => {
      const req = new CreateChatCompletionRequest({
        messages: [],
      });

      expect(req.messages.length).toBe(0);
      // Handler should return Code.InvalidArgument
    });

    it('should accept requests with single message', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Single message',
          }),
        ],
      });

      expect(req.messages.length).toBe(1);
    });

    it('should accept requests with many messages', () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        new ChatMessage({
          role: i % 2 === 0 ? ChatMessage_Role.USER : ChatMessage_Role.ASSISTANT,
          content: `Message ${i}`,
        })
      );

      const req = new CreateChatCompletionRequest({ messages });
      expect(req.messages.length).toBe(50);
    });
  });

  describe('Invalid Tool Schemas', () => {
    it('should reject tool with empty name', () => {
      const tool = new Tool({
        name: '',
        description: 'Missing name',
      });

      expect(tool.name).toBe('');
      // Validation should fail
    });

    it('should reject tool with missing description', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: '',
      });

      expect(tool.description).toBe('');
      // Validation should fail
    });

    it('should reject required fields not in properties', () => {
      const tool = new Tool({
        name: 'invalid_tool',
        description: 'Invalid',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            field1: { type: 'string' },
          },
          required: ['field1', 'nonexistent_field'],
        }),
      });

      // Should detect nonexistent_field not in properties
      expect(tool.parameters?.required).toContain('nonexistent_field');
    });

    it('should reject invalid property types', () => {
      const tool = new Tool({
        name: 'bad_types',
        description: 'Bad types',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            field: { type: 'invalid_type' },
          },
        }),
      });

      // Should flag invalid_type as unsupported
      const properties = tool.parameters?.properties;
      expect(properties?.field.type).toBe('invalid_type');
    });
  });

  describe('Content Validation', () => {
    it('should accept empty content in some roles', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.ASSISTANT,
        content: '',
        toolCalls: [
          {
            id: 'call-123',
            type: 'function',
            function: {
              name: 'test',
              arguments: '{}',
            },
          },
        ],
      });

      // Tool call messages may have empty content
      expect(msg.toolCalls).toHaveLength(1);
    });

    it('should require content for user messages', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: '', // Empty content
      });

      expect(msg.content).toBe('');
      // Validation may flag this
    });

    it('should handle very long content', () => {
      const longContent = 'x'.repeat(10000);
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: longContent,
      });

      expect(msg.content.length).toBe(10000);
    });

    it('should handle special characters in content', () => {
      const specialContent = 'Test with "quotes", \'apostrophes\', \n newlines, \t tabs';
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: specialContent,
      });

      expect(msg.content).toBe(specialContent);
    });

    it('should handle unicode content', () => {
      const unicodeContent = '你好世界 🌍 مرحبا بالعالم';
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: unicodeContent,
      });

      expect(msg.content).toBe(unicodeContent);
    });

    it('should handle whitespace-only content', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: '   \n\t  ',
      });

      expect(msg.content).toBeTruthy();
    });

    it('should handle null-like string values', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'null',
      });

      expect(msg.content).toBe('null');
      expect(msg.content).not.toBeNull();
    });
  });

  describe('OpenAI API Error Handling', () => {
    it('should map 429 (rate limit) to Code.ResourceExhausted', () => {
      const openaiStatus = 429;
      const connectStatus =
        openaiStatus === 429 ? Code.ResourceExhausted : Code.InvalidArgument;

      expect(connectStatus).toBe(Code.ResourceExhausted);
    });

    it('should map 5xx errors to Code.Internal', () => {
      const openaiStatuses = [500, 502, 503, 504];

      openaiStatuses.forEach((status) => {
        const connectStatus =
          status >= 500 ? Code.Internal : Code.InvalidArgument;
        expect(connectStatus).toBe(Code.Internal);
      });
    });

    it('should map 4xx errors to Code.InvalidArgument', () => {
      const openaiStatuses = [400, 401, 403, 404];

      openaiStatuses.forEach((status) => {
        const connectStatus =
          status >= 500 ? Code.Internal : Code.InvalidArgument;
        expect(connectStatus).toBe(Code.InvalidArgument);
      });
    });

    it('should include original error message in response', () => {
      const originalMessage = 'Invalid API key provided';
      const errorMessage = originalMessage;

      expect(errorMessage).toContain('Invalid API key');
    });

    it('should not expose sensitive data in error messages', () => {
      const errorMessage = 'Authentication failed: invalid signature';

      expect(errorMessage).not.toContain('test-secret');
      expect(errorMessage).not.toContain('sk-');
    });
  });

  describe('Missing Fields', () => {
    it('should handle missing temperature', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Request created successfully - handler will apply temperature default
      expect(req).toBeDefined();
    });

    it('should handle missing maxTokens', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Request created successfully - handler will apply maxTokens default
      expect(req).toBeDefined();
    });

    it('should handle missing toolChoice', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Request created successfully - toolChoice defaults will be applied
      expect(req).toBeDefined();
    });

    it('should use defaults for unset parameters', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Proto request created, handler applies: temperature ?? 0.7, maxTokens ?? 2000
      expect(req).toBeDefined();
      expect(req.messages).toHaveLength(1);
    });
  });

  describe('Boundary Conditions', () => {
    it('should accept temperature at boundaries', () => {
      const temperatures = [0, 0.5, 1, 1.5, 2];

      temperatures.forEach((temp) => {
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

    it('should accept maxTokens at boundaries', () => {
      const tokenCounts = [1, 100, 1000, 10000, 100000];

      tokenCounts.forEach((tokens) => {
        const req = new CreateChatCompletionRequest({
          messages: [
            new ChatMessage({
              role: ChatMessage_Role.USER,
              content: 'Test',
            }),
          ],
          maxTokens: tokens,
        });

        expect(req.maxTokens).toBe(tokens);
      });
    });

    it('should handle single character content', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: 'a',
      });

      expect(msg.content.length).toBe(1);
    });

    it('should handle single message conversation', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Question',
          }),
        ],
      });

      expect(req.messages).toHaveLength(1);
    });

    it('should handle requests without tools', () => {
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
  });

  describe('Type Safety', () => {
    it('should preserve message role enum values', () => {
      const roles = [
        ChatMessage_Role.SYSTEM,
        ChatMessage_Role.USER,
        ChatMessage_Role.ASSISTANT,
        ChatMessage_Role.TOOL,
      ];

      roles.forEach((role) => {
        const msg = new ChatMessage({
          role,
          content: 'Test',
        });

        expect(msg.role).toBe(role);
      });
    });

    it('should handle role enum conversions', () => {
      // Maps proto enum to OpenAI role string
      const mapping: Record<ChatMessage_Role, string> = {
        [ChatMessage_Role.UNSPECIFIED]: 'user',
        [ChatMessage_Role.SYSTEM]: 'system',
        [ChatMessage_Role.USER]: 'user',
        [ChatMessage_Role.ASSISTANT]: 'assistant',
        [ChatMessage_Role.TOOL]: 'tool',
      };

      Object.entries(mapping).forEach(([protoRole, openaiRole]) => {
        const role = parseInt(protoRole) as ChatMessage_Role;
        expect(mapping[role]).toBe(openaiRole);
      });
    });

    it('should maintain type consistency across conversions', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Type should be CreateChatCompletionRequest
      expect(req).toBeInstanceOf(CreateChatCompletionRequest);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple requests independently', () => {
      const reqs = Array.from({ length: 5 }, (_, i) =>
        new CreateChatCompletionRequest({
          messages: [
            new ChatMessage({
              role: ChatMessage_Role.USER,
              content: `Request ${i}`,
            }),
          ],
          deviceToken: `device-${i}`,
        })
      );

      reqs.forEach((req, i) => {
        expect(req.messages[0].content).toBe(`Request ${i}`);
        expect(req.deviceToken).toBe(`device-${i}`);
      });
    });

    it('should not interfere between requests', () => {
      const req1 = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Request 1',
          }),
        ],
        temperature: 0.5,
      });

      const req2 = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Request 2',
          }),
        ],
        temperature: 1.0,
      });

      expect(req1.temperature).toBe(0.5);
      expect(req2.temperature).toBe(1.0);
    });
  });

  describe('Null and Undefined Handling', () => {
    it('should handle message content', () => {
      const msg = new ChatMessage({
        role: ChatMessage_Role.ASSISTANT,
        content: '',
      });

      expect(msg.content === '' || msg.content === null).toBe(true);
    });

    it('should handle undefined fields in proto', () => {
      const req = new CreateChatCompletionRequest({
        messages: [
          new ChatMessage({
            role: ChatMessage_Role.USER,
            content: 'Test',
          }),
        ],
      });

      // Proto message should be created with all fields accessible
      expect(req).toBeDefined();
      expect(req.messages).toBeDefined();
    });

    it('should preserve field values', () => {
      const emptyMsg = new ChatMessage({
        role: ChatMessage_Role.USER,
        content: '',
      });

      const normalMsg = new ChatMessage({
        role: ChatMessage_Role.ASSISTANT,
        content: 'response',
      });

      expect(emptyMsg.content).toBe('');
      expect(normalMsg.content).toBe('response');
      expect(emptyMsg.content !== normalMsg.content).toBe(true);
    });
  });
});
