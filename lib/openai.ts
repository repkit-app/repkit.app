import OpenAI from "openai";

/**
 * Shared OpenAI client instance (lazy initialization)
 * Configured with API key from environment variables
 */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. Please add it to your .env file."
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Tool call information returned by assistant messages
 */
export interface ToolCallInfo {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Chat message types for OpenAI API
 * Supports system, user, assistant, and tool roles
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null; // Can be null for tool calls
  name?: string; // Function name for tool results
  tool_call_id?: string; // Required when role is "tool"
  tool_calls?: ToolCallInfo[]; // For assistant messages with tool calls
}

/**
 * Tool parameter definition (JSON Schema subset)
 */
export interface ToolParameterDefinition {
  type: string;
  description?: string;
  enum?: string[];
  [key: string]: unknown; // Allow additional JSON Schema properties
}

/**
 * Tool parameters object (JSON Schema object type)
 * Uses index signature to be compatible with OpenAI SDK's FunctionParameters
 */
export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameterDefinition>;
  required?: string[];
  [key: string]: unknown; // Allow additional JSON Schema properties
}

/**
 * Function definition for a tool
 */
export interface ToolFunctionDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  strict?: boolean; // For structured outputs
}

/**
 * Tool definition for OpenAI API
 */
export interface ToolDefinition {
  type: "function";
  function: ToolFunctionDefinition;
}

/**
 * Tool choice options
 * - "auto": Let the model decide
 * - "none": Don't call any tools
 * - "required": Must call a tool
 * - { type: "function", function: { name: string } }: Call specific function
 */
export type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

/**
 * Request payload for chat completions.
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
}

/**
 * Create a chat completion using the specified model
 *
 * Note: gpt-5-* models require max_completion_tokens instead of max_tokens.
 * The OpenAI SDK types don't enforce this at compile time because max_tokens
 * is still valid for older models - it's a runtime error from OpenAI.
 */
export async function createChatCompletion(
  model: "gpt-4o-mini" | "gpt-4o" | "gpt-5-mini" | "gpt-5.2",
  request: ChatCompletionRequest
): Promise<Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>> {
  const client = getOpenAIClient();

  // gpt-5-* models use max_completion_tokens, older models use max_tokens
  const isGpt5 = model.startsWith("gpt-5");
  const tokenLimit = request.max_tokens ?? 2000;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: request.messages as Parameters<
        typeof client.chat.completions.create
      >[0]["messages"],
      temperature: request.temperature ?? 0.7,
      ...(isGpt5
        ? { max_completion_tokens: tokenLimit }
        : { max_tokens: tokenLimit }),
      stream: false,
      ...(request.tools && { tools: request.tools }),
      ...(request.tool_choice && { tool_choice: request.tool_choice }),
    });

    return completion;
  } catch (error: unknown) {
    // Sentry: Report OpenAI API errors
    const Sentry = await import("@sentry/nextjs");

    Sentry.captureException(error, {
      tags: {
        service: "openai",
        model,
      },
      extra: {
        message_count: request.messages.length,
        has_tools: Boolean(request.tools),
        // DO NOT include message content or tool definitions
      },
    });

    // Re-throw to let API route handle the response
    throw error;
  }
}

/**
 * Official OpenAI pricing (per 1M tokens)
 * Updated: December 2025
 * Source: https://openai.com/api/pricing/
 */
export const PRICING_USD_PER_MTOK = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2.0 },
  "gpt-5.2": { input: 1.75, cached: 0.175, output: 14.0 },
} satisfies Record<
  "gpt-4o-mini" | "gpt-4o" | "gpt-5-mini" | "gpt-5.2",
  { input: number; output: number; cached?: number }
>;

type SupportedModel = keyof typeof PRICING_USD_PER_MTOK;

/**
 * Calculate approximate cost for OpenAI API usage
 * Prices as of December 2025 (per 1M tokens):
 * - gpt-4o-mini: $0.15 input, $0.60 output
 * - gpt-4o: $2.50 input, $10.00 output
 * - gpt-5-mini: $0.25 input, $0.025 cached, $2.00 output (fast, cheap)
 * - gpt-5.2: $1.75 input, $0.175 cached, $14.00 output (agentic tasks)
 */
export function calculateCost(
  model: SupportedModel,
  promptTokens: number,
  completionTokens: number,
  cachedInputTokens: number = 0
): number {
  const price = PRICING_USD_PER_MTOK[model];
  const cachedRate = "cached" in price ? price.cached : price.input;
  const uncachedInputTokens = Math.max(0, promptTokens - cachedInputTokens);
  const inputCost = (uncachedInputTokens / 1_000_000) * price.input;
  const cachedCost = (cachedInputTokens / 1_000_000) * cachedRate;
  const outputCost = (completionTokens / 1_000_000) * price.output;

  return inputCost + cachedCost + outputCost;
}
