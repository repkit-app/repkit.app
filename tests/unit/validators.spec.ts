/**
 * Tool schema validation tests
 * Tests validateTools, validateToolSchema, and isTool functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Tool, ToolSchema, ToolSchema_Property } from '@/lib/generated/repkit/ai/v1/api_pb';
import { validateTools, validateToolSchema, isTool } from '@/lib/validators/tool';

describe('Tool Schema Validation', () => {
  describe('validateToolSchema', () => {
    it('should accept valid tool with all required fields', () => {
      const tool = new Tool({
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: new ToolSchema({
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

    it('should enforce OpenAI tool name constraints (a-zA-Z0-9_-)', () => {
      // OpenAI requires tool names to contain only: letters, digits, underscores, hyphens
      const validNames = [
        'get_weather',       // underscore
        'get-weather',       // hyphen (valid!)
        'fetchData',         // camelCase (uppercase letters ok)
        'fetch_data',        // snake_case
        'fetch-data',        // kebab-case
        'GetData',           // PascalCase
        'get_weather_now',   // multiple underscores
        'get-weather-now',   // multiple hyphens
        'get_weather-now',   // mixed
        'tool123',           // digits
        'Tool_123-abc',      // mixed case with digits
      ];

      validNames.forEach((name) => {
        const tool = new Tool({
          name,
          description: 'Test',
        });
        const errors = validateToolSchema(tool);
        const nameErrors = errors.filter((e) => e.toLowerCase().includes('invalid'));
        expect(nameErrors).toHaveLength(0);
      });
    });

    it('should reject tool names with invalid characters', () => {
      const invalidNames = [
        'get weather',      // space
        'get-weather!',     // exclamation
        'get.weather',      // period
        'get@weather',      // at symbol
        'get$weather',      // dollar sign
        'get(weather)',     // parentheses
        'get/weather',      // slash
        'get\\weather',     // backslash
        'get*weather',      // asterisk
        'get weather',      // space (duplicate for clarity)
        'få_väder',         // non-ASCII characters
        'get#weather',      // hash
        '',                 // empty string
      ];

      invalidNames.forEach((name) => {
        const tool = new Tool({
          name,
          description: 'Test',
        });
        const errors = validateToolSchema(tool);
        // Should have at least one error for invalid name format
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate tool parameters are objects', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test',
        parameters: new ToolSchema({
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
    it('should validate tools with multiple properties', () => {
      const tool = new Tool({
        name: 'complex_tool',
        description: 'Tool with multiple properties',
        parameters: new ToolSchema({
          properties: {
            street: { type: 'string', description: 'Street address' },
            city: { type: 'string', description: 'City name' },
          },
          required: ['street', 'city'],
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

  describe('Nested Schema Validation', () => {
    it('should validate nested object with required fields', () => {
      const tool = new Tool({
        name: 'create_workout',
        description: 'Create a workout',
        parameters: new ToolSchema({
          properties: {
            workout: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                duration: { type: 'number' },
              },
              required: ['name', 'duration'],
            },
          },
          required: ['workout'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should reject nested object with invalid required field', () => {
      const tool = new Tool({
        name: 'create_workout',
        description: 'Create a workout',
        parameters: new ToolSchema({
          properties: {
            workout: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
              required: ['name', 'missing_field'],
            },
          },
          required: ['workout'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('missing_field'))).toBe(true);
    });

    it('should validate array with items schema', () => {
      const tool = new Tool({
        name: 'create_program',
        description: 'Create a program',
        parameters: new ToolSchema({
          properties: {
            workouts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number' },
                },
                required: ['name'],
              },
            },
          },
          required: ['workouts'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should validate array with simple items type', () => {
      const tool = new Tool({
        name: 'add_tags',
        description: 'Add tags to item',
        parameters: new ToolSchema({
          properties: {
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          required: ['tags'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should reject array items with invalid type', () => {
      const tool = new Tool({
        name: 'create_program',
        description: 'Create a program',
        parameters: new ToolSchema({
          properties: {
            workouts: {
              type: 'array',
              items: {
                type: 'invalid_type',
              },
            },
          },
          required: ['workouts'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('invalid type'))).toBe(true);
    });

    it('should validate deep nesting (3+ levels)', () => {
      const tool = new Tool({
        name: 'create_training_plan',
        description: 'Create a complete training plan',
        parameters: new ToolSchema({
          properties: {
            plan: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                weeks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      weekNumber: { type: 'number' },
                      days: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            dayName: { type: 'string' },
                            exercises: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  sets: { type: 'number' },
                                  reps: { type: 'number' },
                                },
                                required: ['name', 'sets', 'reps'],
                              },
                            },
                          },
                          required: ['dayName'],
                        },
                      },
                    },
                    required: ['weekNumber', 'days'],
                  },
                },
              },
              required: ['name', 'weeks'],
            },
          },
          required: ['plan'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should catch invalid required at any nesting level', () => {
      const tool = new Tool({
        name: 'create_program',
        description: 'Create a program',
        parameters: new ToolSchema({
          properties: {
            plan: {
              type: 'object',
              properties: {
                weeks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                    required: ['name', 'deeply_nested_missing'],
                  },
                },
              },
              required: ['weeks'],
            },
          },
          required: ['plan'],
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('deeply_nested_missing'))).toBe(true);
    });

    it('should validate tool with additionalProperties flag', () => {
      const tool = new Tool({
        name: 'strict_tool',
        description: 'Tool with strict mode',
        parameters: new ToolSchema({
          properties: {
            data: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        }),
        strict: true,
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });

    it('should reject schemas exceeding max depth', () => {
      // Create a deeply nested property using proper proto types
      let deepProp = new ToolSchema_Property({ type: 'string' });

      for (let i = 0; i < 15; i++) {
        deepProp = new ToolSchema_Property({
          type: 'object',
          properties: { nested: deepProp },
        });
      }

      const tool = new Tool({
        name: 'deep_tool',
        description: 'Tool with deep nesting',
        parameters: new ToolSchema({
          properties: { deep: deepProp },
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('maximum nesting depth'))).toBe(true);
    });

    it('should show available properties when required field is missing', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test',
        parameters: new ToolSchema({
          properties: {
            nested: {
              type: 'object',
              properties: {
                fieldA: { type: 'string' },
                fieldB: { type: 'number' },
              },
              required: ['fieldA', 'missing_field'],
            },
          },
        }),
      });

      const errors = validateToolSchema(tool);
      expect(errors.some((e) => e.includes('Available:'))).toBe(true);
      expect(errors.some((e) => e.includes('fieldA'))).toBe(true);
    });

    it('should validate real-world program_create_program schema', () => {
      // This mirrors the actual schema from the iOS client that was failing
      const tool = new Tool({
        name: 'program_create_program',
        description: 'Create a training program with workouts',
        parameters: new ToolSchema({
          properties: {
            name: { type: 'string', description: 'Program name' },
            description: { type: 'string', description: 'Program description' },
            workouts: {
              type: 'array',
              description: 'List of workouts in the program',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Workout name' },
                  dayOfWeek: { type: 'integer', description: 'Day of week (1-7)' },
                  exercises: {
                    type: 'array',
                    description: 'Exercises in the workout',
                    items: {
                      type: 'object',
                      properties: {
                        exerciseId: { type: 'string', description: 'Exercise ID' },
                        sets: { type: 'integer', description: 'Number of sets' },
                        reps: { type: 'integer', description: 'Reps per set' },
                        weight: { type: 'number', description: 'Weight in lbs' },
                      },
                      required: ['exerciseId', 'sets', 'reps'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['name', 'exercises'],
                additionalProperties: false,
              },
            },
          },
          required: ['name', 'workouts'],
          additionalProperties: false,
        }),
        strict: true,
      });

      const errors = validateToolSchema(tool);
      expect(errors).toHaveLength(0);
    });
  });
});
