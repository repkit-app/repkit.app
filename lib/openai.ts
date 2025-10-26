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
 * Chat completion request types
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * Create a chat completion using the specified model
 */
export async function createChatCompletion(
  model: "gpt-4o-mini" | "gpt-4o",
  request: ChatCompletionRequest
) {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens ?? 2000,
  });

  return completion;
}

/**
 * Calculate approximate cost for OpenAI API usage
 * Prices as of 2025 (per 1M tokens):
 * - gpt-4o-mini: $0.15 input, $0.60 output
 * - gpt-4o: $2.50 input, $10.00 output
 */
export function calculateCost(
  model: "gpt-4o-mini" | "gpt-4o",
  promptTokens: number,
  completionTokens: number
): number {
  const prices = {
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4o": { input: 2.5, output: 10.0 },
  };

  const price = prices[model];
  const inputCost = (promptTokens / 1_000_000) * price.input;
  const outputCost = (completionTokens / 1_000_000) * price.output;

  return inputCost + outputCost;
}
