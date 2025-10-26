import { NextRequest, NextResponse } from "next/server";

/**
 * OpenAI API Proxy - Mini Model (gpt-4o-mini)
 * Endpoint: /api/ai/chat/mini
 *
 * Purpose: Proxy requests to OpenAI's Chat Completions API
 * using the cost-effective gpt-4o-mini model.
 *
 * This will be fully implemented in issue #2.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Implement OpenAI API proxy
    // - Extract messages from request body
    // - Forward to OpenAI Chat Completions API
    // - Use gpt-4o-mini model
    // - Return streaming response

    return NextResponse.json(
      {
        error: "Not implemented yet. See issue #2 for full implementation.",
        model: "gpt-4o-mini",
        receivedMessages: body.messages?.length || 0,
      },
      { status: 501 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
