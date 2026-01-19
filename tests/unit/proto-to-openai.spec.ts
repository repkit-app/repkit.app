/**
 * Proto to OpenAI conversion tests
 * Tests the conversion of proto tool definitions to OpenAI format
 */

import { describe, it, expect } from 'vitest';
import { Tool, ToolSchema, ToolSchema_Property } from '@/lib/generated/repkit/ai/v1/api_pb';
import {
  protoToOpenAITool,
  convertProperty,
  convertProperties,
} from '@/lib/converters/proto-to-openai';

describe('Proto to OpenAI Conversion', () => {
  describe('protoToOpenAITool', () => {
    it('should convert a simple tool with flat properties', () => {
      const tool = new Tool({
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: new ToolSchema({
          properties: {
            location: new ToolSchema_Property({
              type: 'string',
              description: 'City name',
            }),
          },
          required: ['location'],
        }),
      });

      const result = protoToOpenAITool(tool);

      expect(result.type).toBe('function');
      expect(result.function.name).toBe('get_weather');
      expect(result.function.description).toBe('Get weather for a location');
      expect(result.function.parameters.type).toBe('object');
      expect(result.function.parameters.properties.location).toBeDefined();
      expect(result.function.parameters.properties.location.type).toBe('string');
      expect(result.function.parameters.required).toEqual(['location']);
    });

    it('should convert nested object schemas', () => {
      const tool = new Tool({
        name: 'create_workout',
        description: 'Create a workout',
        parameters: new ToolSchema({
          properties: {
            workout: new ToolSchema_Property({
              type: 'object',
              description: 'Workout details',
              properties: {
                name: new ToolSchema_Property({ type: 'string' }),
                duration: new ToolSchema_Property({ type: 'number' }),
              },
              required: ['name', 'duration'],
            }),
          },
          required: ['workout'],
        }),
      });

      const result = protoToOpenAITool(tool);

      // Verify nested structure is preserved
      const workoutProp = result.function.parameters.properties.workout;
      expect(workoutProp.type).toBe('object');
      expect(workoutProp.properties).toBeDefined();
      expect(workoutProp.properties?.name?.type).toBe('string');
      expect(workoutProp.properties?.duration?.type).toBe('number');
      expect(workoutProp.required).toEqual(['name', 'duration']);
    });

    it('should convert array with items schema', () => {
      const tool = new Tool({
        name: 'add_tags',
        description: 'Add tags to item',
        parameters: new ToolSchema({
          properties: {
            tags: new ToolSchema_Property({
              type: 'array',
              description: 'List of tags',
              items: new ToolSchema_Property({
                type: 'string',
              }),
            }),
          },
          required: ['tags'],
        }),
      });

      const result = protoToOpenAITool(tool);

      const tagsProp = result.function.parameters.properties.tags;
      expect(tagsProp.type).toBe('array');
      expect(tagsProp.items).toBeDefined();
      expect(tagsProp.items?.type).toBe('string');
    });

    it('should convert array of objects with nested properties', () => {
      const tool = new Tool({
        name: 'create_program',
        description: 'Create a program',
        parameters: new ToolSchema({
          properties: {
            workouts: new ToolSchema_Property({
              type: 'array',
              items: new ToolSchema_Property({
                type: 'object',
                properties: {
                  name: new ToolSchema_Property({ type: 'string' }),
                  sets: new ToolSchema_Property({ type: 'integer' }),
                },
                required: ['name', 'sets'],
              }),
            }),
          },
          required: ['workouts'],
        }),
      });

      const result = protoToOpenAITool(tool);

      // Verify nested array items are converted
      const workoutsProp = result.function.parameters.properties.workouts;
      expect(workoutsProp.type).toBe('array');
      expect(workoutsProp.items?.type).toBe('object');
      expect(workoutsProp.items?.properties?.name?.type).toBe('string');
      expect(workoutsProp.items?.properties?.sets?.type).toBe('integer');
      expect(workoutsProp.items?.required).toEqual(['name', 'sets']);
    });

    it('should handle deep nesting (3+ levels)', () => {
      const tool = new Tool({
        name: 'create_plan',
        description: 'Create training plan',
        parameters: new ToolSchema({
          properties: {
            plan: new ToolSchema_Property({
              type: 'object',
              properties: {
                weeks: new ToolSchema_Property({
                  type: 'array',
                  items: new ToolSchema_Property({
                    type: 'object',
                    properties: {
                      days: new ToolSchema_Property({
                        type: 'array',
                        items: new ToolSchema_Property({
                          type: 'object',
                          properties: {
                            exercises: new ToolSchema_Property({
                              type: 'array',
                              items: new ToolSchema_Property({
                                type: 'object',
                                properties: {
                                  name: new ToolSchema_Property({ type: 'string' }),
                                  reps: new ToolSchema_Property({ type: 'integer' }),
                                },
                                required: ['name', 'reps'],
                              }),
                            }),
                          },
                          required: ['exercises'],
                        }),
                      }),
                    },
                    required: ['days'],
                  }),
                }),
              },
              required: ['weeks'],
            }),
          },
          required: ['plan'],
        }),
      });

      const result = protoToOpenAITool(tool);

      // Navigate the deep structure
      const plan = result.function.parameters.properties.plan;
      const weeks = plan.properties?.weeks;
      const weekItems = weeks?.items;
      const days = weekItems?.properties?.days;
      const dayItems = days?.items;
      const exercises = dayItems?.properties?.exercises;
      const exerciseItems = exercises?.items;

      expect(exerciseItems?.type).toBe('object');
      expect(exerciseItems?.properties?.name?.type).toBe('string');
      expect(exerciseItems?.properties?.reps?.type).toBe('integer');
      expect(exerciseItems?.required).toEqual(['name', 'reps']);
    });

    it('should preserve additionalProperties for strict mode', () => {
      const tool = new Tool({
        name: 'strict_tool',
        description: 'Tool with strict mode',
        parameters: new ToolSchema({
          properties: {
            data: new ToolSchema_Property({
              type: 'object',
              properties: {
                value: new ToolSchema_Property({ type: 'string' }),
              },
              additionalProperties: false,
            }),
          },
          additionalProperties: false,
        }),
        strict: true,
      });

      const result = protoToOpenAITool(tool);

      expect(result.function.strict).toBe(true);
      expect(result.function.parameters.additionalProperties).toBe(false);
      expect(result.function.parameters.properties.data.additionalProperties).toBe(false);
    });

    it('should convert enum values', () => {
      const tool = new Tool({
        name: 'set_status',
        description: 'Set status',
        parameters: new ToolSchema({
          properties: {
            status: new ToolSchema_Property({
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
            }),
          },
          required: ['status'],
        }),
      });

      const result = protoToOpenAITool(tool);

      expect(result.function.parameters.properties.status.enum).toEqual([
        'active',
        'inactive',
        'pending',
      ]);
    });

    it('should handle tool without parameters', () => {
      const tool = new Tool({
        name: 'get_time',
        description: 'Get current time',
      });

      const result = protoToOpenAITool(tool);

      expect(result.function.name).toBe('get_time');
      expect(result.function.parameters.type).toBe('object');
      expect(result.function.parameters.properties).toEqual({});
      expect(result.function.parameters.required).toEqual([]);
    });

    it('should convert real-world program_create_program schema', () => {
      // This is the actual schema that was failing
      const tool = new Tool({
        name: 'program_create_program',
        description: 'Create a training program with workouts',
        parameters: new ToolSchema({
          properties: {
            name: new ToolSchema_Property({
              type: 'string',
              description: 'Program name',
            }),
            description: new ToolSchema_Property({
              type: 'string',
              description: 'Program description',
            }),
            workouts: new ToolSchema_Property({
              type: 'array',
              description: 'List of workouts',
              items: new ToolSchema_Property({
                type: 'object',
                properties: {
                  name: new ToolSchema_Property({
                    type: 'string',
                    description: 'Workout name',
                  }),
                  dayOfWeek: new ToolSchema_Property({
                    type: 'integer',
                    description: 'Day of week (1-7)',
                  }),
                  exercises: new ToolSchema_Property({
                    type: 'array',
                    description: 'Exercises in the workout',
                    items: new ToolSchema_Property({
                      type: 'object',
                      properties: {
                        exerciseId: new ToolSchema_Property({
                          type: 'string',
                          description: 'Exercise ID',
                        }),
                        sets: new ToolSchema_Property({
                          type: 'integer',
                          description: 'Number of sets',
                        }),
                        reps: new ToolSchema_Property({
                          type: 'integer',
                          description: 'Reps per set',
                        }),
                        weight: new ToolSchema_Property({
                          type: 'number',
                          description: 'Weight in lbs',
                        }),
                      },
                      required: ['exerciseId', 'sets', 'reps'],
                      additionalProperties: false,
                    }),
                  }),
                },
                required: ['name', 'exercises'],
                additionalProperties: false,
              }),
            }),
          },
          required: ['name', 'workouts'],
          additionalProperties: false,
        }),
        strict: true,
      });

      const result = protoToOpenAITool(tool);

      // Verify the critical nested structure that was causing the error
      expect(result.function.name).toBe('program_create_program');
      expect(result.function.strict).toBe(true);

      // Check workouts array has items
      const workouts = result.function.parameters.properties.workouts;
      expect(workouts.type).toBe('array');
      expect(workouts.items).toBeDefined();
      expect(workouts.items?.type).toBe('object');
      expect(workouts.items?.required).toContain('name');
      expect(workouts.items?.required).toContain('exercises');

      // Check nested exercises array has items
      const exercises = workouts.items?.properties?.exercises;
      expect(exercises?.type).toBe('array');
      expect(exercises?.items?.type).toBe('object');
      expect(exercises?.items?.properties?.exerciseId?.type).toBe('string');
      expect(exercises?.items?.required).toContain('exerciseId');
      expect(exercises?.items?.additionalProperties).toBe(false);
    });
  });

  describe('convertProperty', () => {
    it('should throw error when max depth exceeded', () => {
      // Create a deeply nested property (depth > 10)
      let prop = new ToolSchema_Property({ type: 'object' });
      for (let i = 0; i < 15; i++) {
        prop = new ToolSchema_Property({
          type: 'object',
          properties: { nested: prop },
        });
      }

      expect(() => convertProperty(prop, 0)).toThrow('maximum depth');
    });
  });

  describe('convertProperties', () => {
    it('should return empty object for undefined input', () => {
      const result = convertProperties(undefined);
      expect(result).toEqual({});
    });

    it('should convert multiple properties', () => {
      const props = {
        name: new ToolSchema_Property({ type: 'string' }),
        age: new ToolSchema_Property({ type: 'integer' }),
      };

      const result = convertProperties(props);

      expect(result.name.type).toBe('string');
      expect(result.age.type).toBe('integer');
    });
  });
});
