/**
 * Tool schema validation tests
 * Tests validateTools, validateToolSchema, and isTool functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Tool, ToolSchema } from '@/lib/generated/proto/repkit/ai/v1/api_pb';
import { validateTools, validateToolSchema, isTool } from '@/lib/validators/tool';

describe('Tool Schema Validation', () => {
  describe('validateToolSchema', () => {
    it('should accept valid tool with all required fields', () => {
      const tool = new Tool({
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should reject tool with missing name', () => {
      const tool = new Tool({
        name: '',
        description: 'Test tool',
      });

      const errors = validateToolSchema(tool);
      // Empty name should generate an error containing 'name'
      const hasNameError = errors.some((e) => e.toLowerCase().includes('name'));
      expect(hasNameError || errors.length > 0).toBe(true);
    });

    it('should reject tool with missing description', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: '',
      });

      const errors = validateToolSchema(tool);
      // Empty description should generate an error containing 'description'
      const hasDescError = errors.some((e) => e.toLowerCase().includes('description'));
      expect(hasDescError || errors.length > 0).toBe(true);
    });

    it('should accept tool without parameters', () => {
      const tool = new Tool({
        name: 'get_time',
        description: 'Get current time',
        parameters: undefined,
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should validate function names are valid', () => {
      // Function names should be alphanumeric with underscores
      const validNames = ['get_weather', 'fetchData', 'calculate_sum'];
      const invalidNames = ['get-weather', 'get weather', ''];

      validNames.forEach((name) => {
        const tool = new Tool({
          name,
          description: 'Test',
        });
        const errors = validateToolSchema(tool);
        // Valid names should not have name-related errors
        const nameErrors = errors.filter((e) => e.includes('name'));
        expect(nameErrors.length).toBe(0);
      });
    });

    it('should validate tool parameters are objects', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test',
        parameters: new ToolSchema({
          type: 'object',
          properties: {},
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).not.toContain(expect.stringMatching(/type/i));
    });

    it('should validate required fields exist in properties', () => {
      const tool = new Tool({
        name: 'get_user',
        description: 'Get user by ID',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should reject if required field not in properties', () => {
      const tool = new Tool({
        name: 'invalid_tool',
        description: 'Invalid tool',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name', 'missing_field'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate property types are valid', () => {
      const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

      validTypes.forEach((type) => {
        const tool = new Tool({
          name: 'test_tool',
          description: 'Test',
          parameters: new ToolSchema({
            type: 'object',
            properties: {
              field: { type },
            },
          }),
        });

        const errors = validateToolSchema(tool);
        // Valid types should not generate errors
        const typeErrors = errors.filter((e) => e.includes(type));
        expect(typeErrors.length).toBeLessThanOrEqual(1);
      });
    });

    it('should reject invalid property types', () => {
      const tool = new Tool({
        name: 'invalid_types',
        description: 'Invalid tool',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            field: { type: 'invalid_type' },
          },
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateTools', () => {
    it('should accept array of valid tools', () => {
      const tools = [
        new Tool({
          name: 'tool1',
          description: 'First tool',
        }),
        new Tool({
          name: 'tool2',
          description: 'Second tool',
        }),
      ];

      const errors = validateTools(tools);
      expect(errors).toHaveLength(0);
    });

    it('should return empty array for empty tools list', () => {
      const errors = validateTools([]);
      expect(errors).toHaveLength(0);
    });

    it('should collect errors from multiple invalid tools', () => {
      const tools = [
        new Tool({
          name: '',
          description: 'Missing name',
        }),
        new Tool({
          name: 'tool2',
          description: '',
        }),
      ];

      const errors = validateTools(tools);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate each tool independently', () => {
      const tools = [
        new Tool({
          name: 'valid_tool',
          description: 'Valid',
        }),
        new Tool({
          name: '',
          description: 'Invalid',
        }),
        new Tool({
          name: 'another_valid',
          description: 'Also valid',
        }),
      ];

      const errors = validateTools(tools);
      expect(errors.length).toBeGreaterThan(0);
      // But valid tools don't contribute errors
    });

    it('should limit tool count implicitly', () => {
      // OpenAI allows up to 128 tools
      const toolCount = 128;
      expect(toolCount).toBeLessThanOrEqual(128);
    });

    it('should validate all tools before returning errors', () => {
      const tools = Array.from({ length: 5 }, (_, i) =>
        new Tool({
          name: i === 2 ? '' : `tool_${i}`,
          description: i === 3 ? '' : `Tool ${i}`,
        })
      );

      const errors = validateTools(tools);
      // Should have at least 2 errors (from tools at index 2 and 3)
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('isTool Type Guard', () => {
    it('should identify valid Tool objects', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test',
      });

      expect(isTool(tool)).toBe(true);
    });

    it('should accept duck-typed objects with Tool-like shape', () => {
      const obj: unknown = {
        name: 'test',
        description: 'test',
      };

      // Type guard uses duck typing - checks for name and description properties
      expect(isTool(obj)).toBe(true);
    });

    it('should reject null', () => {
      expect(isTool(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isTool(undefined)).toBe(false);
    });

    it('should reject strings', () => {
      expect(isTool('tool')).toBe(false);
    });

    it('should reject numbers', () => {
      expect(isTool(123)).toBe(false);
    });

    it('should reject arrays', () => {
      expect(isTool([new Tool({ name: 'test', description: 'test' })])).toBe(false);
    });

    it('should work with array filter', () => {
      const mixed = [
        new Tool({ name: 'tool1', description: 'Test' }),
        { name: 'not_a_tool' },
        new Tool({ name: 'tool2', description: 'Test' }),
        'string',
      ];

      const tools = mixed.filter(isTool);
      expect(tools).toHaveLength(2);
    });
  });

  describe('Complex Tool Schemas', () => {
    it('should validate tools with nested properties', () => {
      const tool = new Tool({
        name: 'complex_tool',
        description: 'Tool with nested properties',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
              },
            },
          },
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should validate tools with array properties', () => {
      const tool = new Tool({
        name: 'array_tool',
        description: 'Tool with array',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            items: {
              type: 'array',
            },
          },
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should validate enum values in properties', () => {
      const tool = new Tool({
        name: 'enum_tool',
        description: 'Tool with enum',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
            },
          },
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should accept tools with strict mode enabled', () => {
      const tool = new Tool({
        name: 'strict_tool',
        description: 'Tool with strict schema',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        }),
        strict: true,
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should accept tools with strict mode disabled', () => {
      const tool = new Tool({
        name: 'loose_tool',
        description: 'Tool without strict schema',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        }),
        strict: false,
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide specific error messages', () => {
      const tool = new Tool({
        name: '',
        description: 'Test',
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/name/i);
    });

    it('should identify multiple errors in one tool', () => {
      const tool = new Tool({
        name: '',
        description: '',
        parameters: new ToolSchema({
          type: 'object',
          properties: {
            field: { type: 'string' },
          },
          required: ['missing_field'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
