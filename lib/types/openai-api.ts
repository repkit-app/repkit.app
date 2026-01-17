/**
 * OpenAI API Type Definitions
 * Typed representations of OpenAI API request/response formats
 */

/**
 * Tool parameter definition in OpenAI JSON Schema format
 */
export interface OpenAIToolProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
}

/**
 * OpenAI tool parameters schema
 */
export interface OpenAIToolParameters {
  type: 'object';
  properties: Record<string, OpenAIToolProperty>;
  required?: string[];
}

/**
 * OpenAI function definition within a tool
 */
export interface OpenAIToolFunction {
  name: string;
  description: string;
  parameters?: OpenAIToolParameters;
  strict?: boolean;
}

/**
 * OpenAI tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: OpenAIToolFunction;
}

/**
 * OpenAI tool choice - can be auto, none, required, or specific function
 */
export type OpenAIToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

/**
 * Type guard to check if a value is an error with status property
 */
export function isErrorWithStatus(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    typeof (error as any).status === 'number'
  );
}

/**
 * Type guard for OpenAI response with id field
 */
export function hasIdField(obj: unknown): obj is { id: string } {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
