/**
 * Proto to OpenAI Conversion
 * Converts proto tool definitions to OpenAI format
 *
 * Handles nested object and array schemas for OpenAI strict mode
 * with depth limits for safety.
 */

import type { Tool, ToolSchema_Property } from '@/lib/generated/repkit/ai/v1/api_pb';
import type { OpenAITool, OpenAIToolProperty } from '@/lib/types/openai-api';

/**
 * Maximum nesting depth for tool schemas
 * Prevents stack overflow from malformed or malicious schemas
 */
const MAX_SCHEMA_DEPTH = 10;

/**
 * Valid JSON Schema types for OpenAI tools
 */
const VALID_PROPERTY_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'] as const;
type ValidPropertyType = typeof VALID_PROPERTY_TYPES[number];

/**
 * Type guard to check if a value is a valid OpenAI property type
 * Validates at runtime instead of using unsafe type assertions
 *
 * @param value - Value to check
 * @returns True if value is a valid property type
 */
function isValidPropertyType(value: unknown): value is ValidPropertyType {
  return typeof value === 'string' && VALID_PROPERTY_TYPES.includes(value as ValidPropertyType);
}

/**
 * Convert a single proto Property to OpenAI property format
 * Recursively handles nested objects and arrays with depth limiting
 *
 * @param prop - Proto property to convert
 * @param depth - Current recursion depth (for safety limits)
 * @returns OpenAI property format
 * @throws Error if max depth exceeded
 */
export function convertProperty(
  prop: InstanceType<typeof ToolSchema_Property>,
  depth: number = 0
): OpenAIToolProperty {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new Error(
      `Schema nesting exceeds maximum depth of ${MAX_SCHEMA_DEPTH}. ` +
      `This may indicate a malformed schema.`
    );
  }

  // Validate type at runtime for safety
  if (!isValidPropertyType(prop.type)) {
    throw new Error(
      `Invalid property type "${prop.type}". Valid types: ${VALID_PROPERTY_TYPES.join(', ')}`
    );
  }

  const result: OpenAIToolProperty = {
    type: prop.type,
    description: prop.description,
    enum: prop.enum && prop.enum.length > 0 ? prop.enum : undefined,
  };

  // Handle nested object properties
  if (prop.properties && Object.keys(prop.properties).length > 0) {
    result.properties = convertProperties(prop.properties, depth + 1);
    // Consistent handling: always include required array for objects
    result.required = prop.required && prop.required.length > 0 ? prop.required : [];
  }

  // Handle array items
  if (prop.items) {
    result.items = convertProperty(prop.items, depth + 1);
  }

  // Handle additionalProperties for strict mode
  if (prop.additionalProperties !== undefined) {
    result.additionalProperties = prop.additionalProperties;
  }

  return result;
}

/**
 * Convert proto properties map to OpenAI properties
 *
 * @param protoProps - Map of proto properties
 * @param depth - Current recursion depth
 * @returns Record of OpenAI properties
 */
export function convertProperties(
  protoProps: Record<string, InstanceType<typeof ToolSchema_Property>> | undefined,
  depth: number = 0
): Record<string, OpenAIToolProperty> {
  if (!protoProps) return {};

  const result: Record<string, OpenAIToolProperty> = {};
  for (const [key, prop] of Object.entries(protoProps)) {
    result[key] = convertProperty(prop, depth);
  }
  return result;
}

/**
 * Convert proto Tool to OpenAI Tool format
 * OpenAI requires parameters, so tools without them get empty properties
 *
 * @param tool - Proto tool definition
 * @returns OpenAI tool format
 */
export function protoToOpenAITool(tool: InstanceType<typeof Tool>): OpenAITool {
  // Parameters are required by OpenAI - validated during request processing
  const parameters = tool.parameters
    ? {
        type: 'object' as const,
        properties: convertProperties(tool.parameters.properties, 0),
        required: tool.parameters.required || [],
        // Include additionalProperties at schema level for strict mode
        ...(tool.parameters.additionalProperties !== undefined && {
          additionalProperties: tool.parameters.additionalProperties,
        }),
      }
    : {
        type: 'object' as const,
        properties: {},
        required: [] as string[],
      };

  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters,
      strict: tool.strict || false,
    },
  };
}
