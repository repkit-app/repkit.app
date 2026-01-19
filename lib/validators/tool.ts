/**
 * Tool Schema Validation
 * Validates tool definitions against JSON Schema constraints before sending to OpenAI
 *
 * Includes validation result caching to avoid repeated validation of identical tool sets.
 * Cache is keyed by a hash of the serialized tool definitions.
 *
 * Supports nested object and array schemas for OpenAI strict mode.
 */

import { createHash } from 'crypto';
import type { Tool, ToolSchema_Property } from '@/lib/generated/repkit/ai/v1/api_pb';

/**
 * Cache for tool validation results
 * Maps tool definition hash → validation errors array
 * Initialized once and reused across requests
 */
const validationCache = new Map<string, string[]>();

/**
 * Generate a hash of tool definitions for cache key
 * Ensures identical tool sets map to the same cache entry
 */
function getToolsHash(tools: Tool[]): string {
  const toolStrings = tools
    .map(t => `${t.name}|${t.description}|${JSON.stringify(t.parameters)}`)
    .sort();

  return createHash('sha256')
    .update(toolStrings.join('\n'))
    .digest('hex');
}

/**
 * OpenAI tool name constraints
 * Tool names must contain only: a-z, A-Z, 0-9, -, _
 * This matches OpenAI's API requirements for tool names
 */
const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Valid JSON Schema types
 */
const VALID_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

/**
 * Maximum nesting depth for tool schemas
 * Prevents stack overflow from malformed or malicious schemas
 */
const MAX_SCHEMA_DEPTH = 10;

/**
 * Validate a property and its nested structure recursively
 *
 * @param prop - Property to validate
 * @param path - Path to the property for error messages (e.g., "parameters.workouts.items")
 * @param toolName - Tool name for error context
 * @param depth - Current recursion depth for safety limits
 * @param strictMode - Whether strict mode validation is enabled
 * @returns Array of error messages
 */
function validateProperty(
  prop: ToolSchema_Property,
  path: string,
  toolName: string,
  depth: number = 0,
  strictMode: boolean = false
): string[] {
  const errors: string[] = [];

  // Check depth limit
  if (depth > MAX_SCHEMA_DEPTH) {
    errors.push(
      `Tool "${toolName}": schema at "${path}" exceeds maximum nesting depth of ${MAX_SCHEMA_DEPTH}`
    );
    return errors;
  }

  // Validate type
  if (!prop.type || !VALID_TYPES.includes(prop.type)) {
    errors.push(
      `Tool "${toolName}": property "${path}" has invalid type "${prop.type}". Valid types: ${VALID_TYPES.join(', ')}`
    );
  }

  // Strict mode validation for objects
  if (strictMode && prop.type === 'object') {
    // In strict mode, all objects must have additionalProperties: false
    if (prop.additionalProperties !== false) {
      errors.push(
        `Tool "${toolName}": strict mode requires additionalProperties: false at "${path}"`
      );
    }

    // In strict mode, all properties must be in the required array
    if (prop.properties && Object.keys(prop.properties).length > 0) {
      const propNames = Object.keys(prop.properties);
      const requiredFields = prop.required || [];
      const missingRequired = propNames.filter(name => !requiredFields.includes(name));

      if (missingRequired.length > 0) {
        errors.push(
          `Tool "${toolName}": strict mode requires all properties to be in required array at "${path}". ` +
          `Missing: ${missingRequired.join(', ')}`
        );
      }
    }
  }

  // Validate nested object properties
  if (prop.properties && Object.keys(prop.properties).length > 0) {
    // Check required fields exist in nested properties
    if (prop.required && prop.required.length > 0) {
      for (const requiredField of prop.required) {
        if (!prop.properties[requiredField]) {
          errors.push(
            `Tool "${toolName}": required field "${requiredField}" not found in "${path}.properties". ` +
            `Available: ${Object.keys(prop.properties).join(', ')}`
          );
        }
      }
    }

    // Recursively validate nested properties
    for (const [nestedName, nestedProp] of Object.entries(prop.properties)) {
      errors.push(...validateProperty(nestedProp, `${path}.${nestedName}`, toolName, depth + 1, strictMode));
    }
  }

  // Validate array items
  if (prop.items) {
    errors.push(...validateProperty(prop.items, `${path}.items`, toolName, depth + 1, strictMode));
  }

  return errors;
}

/**
 * Validate a single tool schema
 * Ensures required properties exist in properties map
 * Recursively validates nested object and array schemas
 *
 * @param tool - Tool definition to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateToolSchema(tool: Tool): string[] {
  const errors: string[] = [];

  // Validate tool name
  if (!tool.name || typeof tool.name !== 'string') {
    errors.push('Tool name is required and must be a string');
  } else if (!TOOL_NAME_PATTERN.test(tool.name)) {
    errors.push(
      `Tool name "${tool.name}" is invalid. Tool names must contain only letters, digits, underscores, and hyphens (a-zA-Z0-9_-)`
    );
  }

  // Validate description
  if (!tool.description || typeof tool.description !== 'string') {
    errors.push('Tool description is required and must be a string');
  }

  // If no parameters, that's valid (tool requires no input)
  if (!tool.parameters) {
    return errors;
  }

  const schema = tool.parameters;

  // Validate properties object exists
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    errors.push('Tool parameters must have a properties object');
    return errors;
  }

  // Validate required array at top level
  if (schema.required && schema.required.length > 0) {
    // Check each required field exists in properties
    for (const requiredField of schema.required) {
      if (!schema.properties[requiredField]) {
        errors.push(
          `Tool "${tool.name}": required field "${requiredField}" not found in properties`
        );
      }
    }
  }

  // Validate strict mode requirements at top level
  const strictMode = tool.strict === true;
  if (strictMode) {
    // Top-level must have additionalProperties: false
    if (schema.additionalProperties !== false) {
      errors.push(
        `Tool "${tool.name}": strict mode requires additionalProperties: false at top level`
      );
    }

    // All top-level properties must be in required array
    const propNames = Object.keys(schema.properties);
    const requiredFields = schema.required || [];
    const missingRequired = propNames.filter(name => !requiredFields.includes(name));

    if (missingRequired.length > 0) {
      errors.push(
        `Tool "${tool.name}": strict mode requires all properties to be in required array. ` +
        `Missing: ${missingRequired.join(', ')}`
      );
    }
  }

  // Validate each property recursively (handles nested objects and arrays)
  for (const [propName, prop] of Object.entries(schema.properties)) {
    errors.push(...validateProperty(prop, propName, tool.name, 0, strictMode));
  }

  return errors;
}

/**
 * Validate an array of tools
 * Returns errors for all invalid tools
 *
 * Uses caching to avoid repeated validation of identical tool sets.
 * Validation results are cached indefinitely per tool definition hash.
 *
 * @param tools - Tools to validate
 * @returns Array of error messages (empty if all valid)
 */
export function validateTools(tools: Tool[]): string[] {
  if (!Array.isArray(tools)) {
    return ['Tools must be an array'];
  }

  // Check cache first
  const toolsHash = getToolsHash(tools);
  const cached = validationCache.get(toolsHash);

  if (cached) {
    // Return a copy to prevent cache pollution
    return [...cached];
  }

  // Validate all tools
  const errors: string[] = [];
  for (const tool of tools) {
    const toolErrors = validateToolSchema(tool);
    errors.push(...toolErrors);
  }

  // Cache the result
  validationCache.set(toolsHash, errors);

  return errors;
}

/**
 * Type guard for checking if value is a Tool
 */
export function isTool(value: unknown): value is Tool {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.description === 'string'
  );
}
