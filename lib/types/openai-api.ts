/**
 * OpenAI API Type Definitions
 * Typed representations of OpenAI API request/response formats
 */

/**
 * Tool parameter definition in OpenAI JSON Schema format
 * Supports additional properties for extensibility
 */
export interface OpenAIToolProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  [key: string]: unknown; // Allow additional JSON Schema properties
}

/**
 * OpenAI tool parameters schema
 * Uses index signature for compatibility with JSON Schema
 */
export interface OpenAIToolParameters {
  type: 'object';
  properties: Record<string, OpenAIToolProperty>;
  required?: string[];
  [key: string]: unknown; // Allow additional JSON Schema properties
}

/**
 * OpenAI function definition within a tool
 * Note: parameters are required by the OpenAI API for proper tool calling
 */
export interface OpenAIToolFunction {
  name: string;
  description: string;
  parameters: OpenAIToolParameters;
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
  if (!(error instanceof Error)) return false;
  return typeof (error as unknown as Record<PropertyKey, unknown>).status === 'number';
}

/**
 * Type guard for OpenAI response with id field
 */
export function hasIdField(obj: unknown): obj is { id: string } {
  return typeof obj === 'object' && obj !== null && 'id' in obj && typeof (obj as { id: unknown }).id === 'string';
}

/**
 * OpenAI chat completion response choice
 */
export interface OpenAIChatCompletionChoice {
  index: number;
  message: {
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  finish_reason: string | null;
}

/**
 * OpenAI token usage details with optional cached tokens
 */
export interface OpenAIUsageDetails {
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

/**
 * OpenAI chat completion response
 */
export interface OpenAIChatCompletionResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  choices: OpenAIChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } & OpenAIUsageDetails;
}

/**
 * OpenAI chat completion streaming chunk delta
 */
export interface OpenAIChatCompletionChunkDelta {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

/**
 * OpenAI chat completion streaming chunk choice
 */
export interface OpenAIChatCompletionChunkChoice {
  index: number;
  delta?: OpenAIChatCompletionChunkDelta;
  finish_reason: string | null;
}

/**
 * OpenAI chat completion streaming chunk
 */
export interface OpenAIChatCompletionChunk {
  id: string;
  model: string;
  created: number;
  object: string;
  choices: OpenAIChatCompletionChunkChoice[];
}
