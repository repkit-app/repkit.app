/**
 * ChatService Handlers
 * Implements Connect RPC methods for AI chat completions
 */

import { ConnectRouter, Code, ConnectError } from '@connectrpc/connect';
import { ChatService } from '@/lib/generated/repkit/ai/v1/api_connect';
import {
  CreateChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatMessage as ProtoMessage,
  Choice,
  Delta,
  DeltaChoice,
  ChatMessage_Role,
  ToolCall,
  Tool,
  ToolChoice,
  ToolSchema_Property,
  Usage,
  PromptTokenDetails,
} from '@/lib/generated/repkit/ai/v1/api_pb';
import {
  createChatCompletion,
  createChatCompletionStream,
  type ChatMessage as OpenAIMessage,
} from '@/lib/openai';
import { validateTools } from '@/lib/validators/tool';
import {
  type OpenAITool,
  type OpenAIToolChoice,
  type OpenAIToolProperty,
  type OpenAIChatCompletionChoice,
  type OpenAIChatCompletionResponse,
  type OpenAIChatCompletionChunk,
  type OpenAIUsageDetails,
  isErrorWithStatus,
  hasIdField,
} from '@/lib/types/openai-api';

/**
 * Convert proto Tool to OpenAI Tool format
 * OpenAI requires parameters, so tools without them are invalid
 */
function protoToOpenAITool(tool: InstanceType<typeof Tool>): OpenAITool {
  // Convert proto properties to OpenAI properties
  const convertProperties = (
    protoProps: Record<string, InstanceType<typeof ToolSchema_Property>> | undefined
  ): Record<string, OpenAIToolProperty> => {
    if (!protoProps) return {};

    const result: Record<string, OpenAIToolProperty> = {};
    for (const [key, prop] of Object.entries(protoProps)) {
      result[key] = {
        type: prop.type as 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object',
        description: prop.description,
        enum: prop.enum && prop.enum.length > 0 ? prop.enum : undefined,
      };
    }
    return result;
  };

  // Parameters are required by OpenAI - validated during request processing
  const parameters = tool.parameters
    ? {
        type: 'object' as const,
        properties: convertProperties(tool.parameters.properties),
        required: tool.parameters.required || [],
      }
    : {
        type: 'object' as const,
        properties: {},
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

/**
 * Convert proto ToolChoice to OpenAI ToolChoice format
 */
function protoToOpenAIToolChoice(toolChoice: unknown): OpenAIToolChoice | undefined {
  if (!toolChoice) return undefined;

  // Handle string choices (auto, none, required)
  if (typeof toolChoice === 'string') {
    if (toolChoice === 'auto' || toolChoice === 'none' || toolChoice === 'required') {
      return toolChoice;
    }
  }

  // Handle specific tool choice (proto oneof with string_choice or function)
  const tc = toolChoice as Record<string, unknown>;

  // Proto oneof uses "string_choice" field name (snake_case from proto)
  if (tc.string_choice) {
    const str = String(tc.string_choice);
    if (str === 'auto' || str === 'none' || str === 'required') {
      return str as OpenAIToolChoice;
    }
  }

  // Proto oneof uses "function" field pointing to SpecificTool message
  if (tc.function && typeof tc.function === 'object') {
    const fn = tc.function as Record<string, unknown>;
    // SpecificTool has function_name field (snake_case from proto)
    if (fn.function_name) {
      return {
        type: 'function' as const,
        function: {
          name: String(fn.function_name),
        },
      };
    }
  }

  return undefined;
}

/**
 * Convert proto ChatMessage to OpenAI ChatMessage
 */
function protoToOpenAIMessage(msg: ProtoMessage): OpenAIMessage {
  // Convert proto role enum to OpenAI role string
  const roleMap: Record<ChatMessage_Role, 'system' | 'user' | 'assistant' | 'tool'> = {
    [ChatMessage_Role.UNSPECIFIED]: 'user',
    [ChatMessage_Role.SYSTEM]: 'system',
    [ChatMessage_Role.USER]: 'user',
    [ChatMessage_Role.ASSISTANT]: 'assistant',
    [ChatMessage_Role.TOOL]: 'tool',
  };

  return {
    role: roleMap[msg.role as ChatMessage_Role] || 'user',
    content: msg.content || null,
    name: msg.name,
    tool_call_id: msg.toolCallId,
    tool_calls: msg.toolCalls?.map((tc: ToolCall) => ({
      id: tc.id,
      type: tc.type as 'function',
      function: {
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '',
      },
    })),
  };
}

/**
 * Convert OpenAI response to proto ChatCompletionResponse
 */
function openAIToProtoResponse(
  response: Awaited<ReturnType<typeof createChatCompletion>>
): ChatCompletionResponse {
  // Type assert the response with our known structure
  const completion = response as unknown as OpenAIChatCompletionResponse;

  const protoResponse = new ChatCompletionResponse({
    id: completion.id,
    model: completion.model,
    created: completion.created.toString(),
    object: completion.object,
  });

  if (completion.choices && completion.choices.length > 0) {
    protoResponse.choices = completion.choices.map(
      (choice) =>
        new Choice({
          index: choice.index,
          finishReason: choice.finish_reason || '',
          message: {
            role: 'assistant',
            content: choice.message.content ?? undefined,
            toolCalls: choice.message.tool_calls?.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          },
        })
    );
  }

  if (completion.usage) {
    const cachedTokens = completion.usage.prompt_tokens_details?.cached_tokens || 0;

    protoResponse.usage = new Usage({
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
      promptTokensDetails: cachedTokens
        ? new PromptTokenDetails({ cachedTokens })
        : undefined,
    });
  }

  return protoResponse;
}

/**
 * Validate and convert request for both unary and streaming handlers
 * Reduces duplication between handlers
 */
interface ValidatedRequest {
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  toolChoice?: OpenAIToolChoice;
}

function validateAndConvertRequest(req: CreateChatCompletionRequest): ValidatedRequest {
  // Validate input
  if (!req.messages || req.messages.length === 0) {
    throw new ConnectError(
      'Messages array is required and cannot be empty',
      Code.InvalidArgument
    );
  }

  // Validate tool schemas
  if (req.tools && req.tools.length > 0) {
    const toolErrors = validateTools(req.tools);
    if (toolErrors.length > 0) {
      throw new ConnectError(
        `Invalid tool schema: ${toolErrors.join('; ')}`,
        Code.InvalidArgument
      );
    }
  }

  return {
    messages: req.messages.map(protoToOpenAIMessage),
    tools: req.tools?.map(protoToOpenAITool),
    toolChoice: protoToOpenAIToolChoice(req.toolChoice),
  };
}

/**
 * Shared request handler logic
 * Reduces duplication between createStandardCompletion and createMiniCompletion
 */
async function handleChatCompletionRequest(
  req: CreateChatCompletionRequest,
  defaultModel: 'gpt-5.2' | 'gpt-4o-mini'
): Promise<ChatCompletionResponse> {
  try {
    // Validate and convert request
    const validated = validateAndConvertRequest(req);

    // Determine model to use (client can override via req.model)
    type ValidModel = 'gpt-4o-mini' | 'gpt-4o' | 'gpt-5-mini' | 'gpt-5.2';
    const isValidModel = (value: string | undefined): value is ValidModel => {
      return value !== undefined && ['gpt-4o-mini', 'gpt-4o', 'gpt-5-mini', 'gpt-5.2'].includes(value);
    };

    const model: ValidModel = isValidModel(req.model) ? req.model : defaultModel;

    // Call OpenAI with configurable model
    const completion = await createChatCompletion(model, {
      messages: validated.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2000,
      tools: validated.tools,
      tool_choice: validated.toolChoice,
    });

    // Convert response to proto format
    return openAIToProtoResponse(completion);
  } catch (error) {
    // Handle OpenAI errors with proper type checking
    if (isErrorWithStatus(error)) {
      throw new ConnectError(
        error.message,
        error.status === 429
          ? Code.ResourceExhausted
          : error.status >= 500
            ? Code.Internal
            : Code.InvalidArgument
      );
    }

    throw error;
  }
}

/**
 * ChatService Handler Registration
 */
export function registerChatServiceHandlers(router: ConnectRouter) {
  router.service(ChatService, {
    async createStandardCompletion(
      req: CreateChatCompletionRequest
    ): Promise<ChatCompletionResponse> {
      return handleChatCompletionRequest(req, 'gpt-5.2');
    },

    async createMiniCompletion(
      req: CreateChatCompletionRequest
    ): Promise<ChatCompletionResponse> {
      return handleChatCompletionRequest(req, 'gpt-4o-mini');
    },

    async *streamStandardCompletion(
      req: CreateChatCompletionRequest
    ): AsyncGenerator<ChatCompletionChunk> {
      try {
        // Validate and convert request (shared with unary handlers)
        const validated = validateAndConvertRequest(req);

        // Determine model to use (client can override via req.model)
        type ValidModel = 'gpt-4o-mini' | 'gpt-4o' | 'gpt-5-mini' | 'gpt-5.2';
        const isValidModel = (value: string | undefined): value is ValidModel => {
          return value !== undefined && ['gpt-4o-mini', 'gpt-4o', 'gpt-5-mini', 'gpt-5.2'].includes(value);
        };

        const model: ValidModel = isValidModel(req.model) ? req.model : 'gpt-5.2';

        // Call OpenAI with streaming
        const stream = createChatCompletionStream(model, {
          messages: validated.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2000,
          tools: validated.tools,
          tool_choice: validated.toolChoice,
        });

        // Iterate over stream and convert chunks to proto format
        for await (const openaiChunk of stream) {
          const chunk = new ChatCompletionChunk({
            id: openaiChunk.id,
            model: openaiChunk.model,
            created: openaiChunk.created.toString(),
            object: 'chat.completion.chunk',
          });

          if (openaiChunk.choices && openaiChunk.choices.length > 0) {
            chunk.choices = openaiChunk.choices.map((choice) => {
              const deltaContent = choice.delta?.content || '';
              const deltaToolCalls = choice.delta?.tool_calls?.map((tc) => ({
                index: tc.index,
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                },
              })) || [];

              return new DeltaChoice({
                index: choice.index,
                finishReason: choice.finish_reason || '',
                delta: new Delta({
                  role: 'assistant',
                  content: deltaContent,
                  toolCalls: deltaToolCalls.length > 0 ? deltaToolCalls : undefined,
                }),
              });
            });
          }

          yield chunk;
        }
      } catch (error) {
        // Handle OpenAI errors with proper type checking
        if (isErrorWithStatus(error)) {
          throw new ConnectError(
            error.message,
            error.status === 429
              ? Code.ResourceExhausted
              : error.status >= 500
                ? Code.Internal
                : Code.InvalidArgument
          );
        }

        throw error;
      }
    },
  });
}
