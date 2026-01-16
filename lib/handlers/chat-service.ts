/**
 * ChatService Handlers
 * Implements Connect RPC methods for AI chat completions
 */

import { ConnectRouter, Code, ConnectError } from '@connectrpc/connect';
import { ChatService } from '@/lib/generated/proto/repkit/ai/v1/api_connect';
import {
  CreateChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatMessage as ProtoMessage,
  Delta,
  DeltaChoice,
  ChatMessage_Role,
  ToolCall,
  Usage,
  PromptTokenDetails,
} from '@/lib/generated/proto/repkit/ai/v1/api_pb';
import {
  createChatCompletion,
  type ChatMessage as OpenAIMessage,
} from '@/lib/openai';
import { validateTools } from '@/lib/validators/tool';

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
  // Handle both direct responses and wrapped responses from OpenAI API
  const completion = 'id' in response ? response : (response as any).message;

  const protoResponse = new ChatCompletionResponse({
    id: completion.id,
    model: completion.model,
    created: completion.created.toString(),
    object: completion.object as string,
  });

  if (completion.choices && completion.choices.length > 0) {
    protoResponse.choices = completion.choices.map(
      (choice: any, index: number) => ({
        index,
        finishReason: choice.finish_reason || '',
        message: {
          role: 'assistant' as const,
          content: choice.message?.content || '',
          toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
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
    const cachedTokens =
      (completion.usage as any).prompt_tokens_details?.cached_tokens || 0;

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
 * ChatService Handler Registration
 */
export default function registerChatServiceHandlers(router: ConnectRouter) {
  router.service(ChatService, {
    async createStandardCompletion(
      req: CreateChatCompletionRequest
    ): Promise<ChatCompletionResponse> {
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

      try {
        // Convert proto messages to OpenAI format
        const openaiMessages = req.messages.map(protoToOpenAIMessage);

        // Convert proto tools to OpenAI format with type casting
        // Note: TypeScript can't statically verify the properties match,
        // so we cast to any for the parameters property
        const openaiTools = req.tools?.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
              ? {
                  type: 'object' as const,
                  properties: tool.parameters.properties || {},
                  required: tool.parameters.required || [],
                }
              : { type: 'object' as const, properties: {} },
            strict: tool.strict || false,
          },
        })) as any;

        // Call OpenAI
        const completion = await createChatCompletion('gpt-5.2', {
          messages: openaiMessages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2000,
          tools: openaiTools,
          tool_choice: req.toolChoice as any,
        });

        // Convert response to proto format
        return openAIToProtoResponse(completion);
      } catch (error) {
        // Handle OpenAI errors
        if (error instanceof Error && (error as any).status !== undefined) {
          const status = (error as any).status;
          const message = error.message;

          throw new ConnectError(
            message,
            status === 429
              ? Code.ResourceExhausted
              : status >= 500
                ? Code.Internal
                : Code.InvalidArgument
          );
        }

        throw error;
      }
    },

    async createMiniCompletion(
      req: CreateChatCompletionRequest
    ): Promise<ChatCompletionResponse> {
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

      try {
        // Convert proto messages to OpenAI format
        const openaiMessages = req.messages.map(protoToOpenAIMessage);

        // Convert proto tools to OpenAI format
        const openaiTools = req.tools?.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
              ? {
                  type: 'object' as const,
                  properties: tool.parameters.properties || {},
                  required: tool.parameters.required || [],
                }
              : { type: 'object' as const, properties: {} },
            strict: tool.strict || false,
          },
        })) as any;

        // Call OpenAI
        const completion = await createChatCompletion('gpt-4o-mini', {
          messages: openaiMessages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2000,
          tools: openaiTools,
          tool_choice: req.toolChoice as any,
        });

        // Convert response to proto format
        return openAIToProtoResponse(completion);
      } catch (error) {
        // Handle OpenAI errors
        if (error instanceof Error && (error as any).status !== undefined) {
          const status = (error as any).status;
          const message = error.message;

          throw new ConnectError(
            message,
            status === 429
              ? Code.ResourceExhausted
              : status >= 500
                ? Code.Internal
                : Code.InvalidArgument
          );
        }

        throw error;
      }
    },

    async *streamStandardCompletion(
      req: CreateChatCompletionRequest
    ): AsyncGenerator<ChatCompletionChunk> {
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

      try {
        // Convert proto messages to OpenAI format
        const openaiMessages = req.messages.map(protoToOpenAIMessage);

        // Convert proto tools to OpenAI format
        const openaiTools = req.tools?.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
              ? {
                  type: 'object' as const,
                  properties: tool.parameters.properties || {},
                  required: tool.parameters.required || [],
                }
              : { type: 'object' as const, properties: {} },
            strict: tool.strict || false,
          },
        })) as any;

        // Note: Streaming not fully implemented in createChatCompletion yet
        // This is a placeholder that will work once streaming is added
        const completion = await createChatCompletion('gpt-5.2', {
          messages: openaiMessages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2000,
          tools: openaiTools,
          tool_choice: req.toolChoice as any,
        });

        // For now, treat non-streaming response as single chunk
        // TODO: Once streaming is implemented, iterate over chunks
        if (!('id' in completion)) {
          // It's a stream, iterate over it
          // const stream = completion as AsyncIterable<any>;
          // for await (const chunk of stream) {
          //   yield convertChunk(chunk);
          // }
          throw new ConnectError(
            'Streaming not yet implemented',
            Code.Internal
          );
        }

        // Convert to streaming response format
        const chunk = new ChatCompletionChunk({
          id: completion.id,
          model: completion.model,
          created: completion.created.toString(),
          object: 'chat.completion.chunk',
        });

        if (completion.choices && completion.choices.length > 0) {
          const choice = completion.choices[0] as any;
          chunk.choices = [
            new DeltaChoice({
              index: 0,
              finishReason: choice.finish_reason || 'stop',
              delta: new Delta({
                role: 'assistant',
                content: choice.message?.content || '',
                toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                })),
              }),
            }),
          ];
        }

        yield chunk;
      } catch (error) {
        // Handle OpenAI errors
        if (error instanceof Error && (error as any).status !== undefined) {
          const status = (error as any).status;
          const message = error.message;

          throw new ConnectError(
            message,
            status === 429
              ? Code.ResourceExhausted
              : status >= 500
                ? Code.Internal
                : Code.InvalidArgument
          );
        }

        throw error;
      }
    },
  });
}
