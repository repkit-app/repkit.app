/**
 * Mock OpenAI API responses for testing
 */

export const mockChatCompletionResponse = {
  id: 'chatcmpl-test123',
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a test response.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
};

export const mockToolCallResponse = {
  id: 'chatcmpl-test456',
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'gpt-5.2',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_test123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location":"San Francisco","unit":"celsius"}',
            },
          },
        ],
      },
      finish_reason: 'tool_calls',
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: 15,
    total_tokens: 35,
  },
};

export const mockCachedTokensResponse = {
  id: 'chatcmpl-test789',
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'gpt-5.2',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Response with cached tokens.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 30,
    completion_tokens: 10,
    total_tokens: 40,
    prompt_tokens_details: {
      cached_tokens: 10,
    },
  },
};
