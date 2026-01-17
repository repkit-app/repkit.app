/**
 * Tool Schema Validation
 * Validates tool definitions against JSON Schema constraints before sending to OpenAI
 *
 * Includes validation result caching to avoid repeated validation of identical tool sets.
 * Cache is keyed by a hash of the serialized tool definitions.
 */

import { createHash } from 'crypto';
import type { Tool, ToolSchema } from '@/lib/generated/repkit/ai/v1/api_pb';

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
 * Validate a single tool schema
 * Ensures required properties exist in properties map
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

  // Validate required array
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

  // Validate each property has valid type
  const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
  for (const [propName, prop] of Object.entries(schema.properties)) {
    if (!prop.type || !validTypes.includes(prop.type)) {
      errors.push(
        `Tool "${tool.name}": property "${propName}" has invalid type "${prop.type}". Valid types: ${validTypes.join(', ')}`
      );
    }
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
