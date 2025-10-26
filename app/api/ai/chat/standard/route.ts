import { NextRequest, NextResponse } from "next/server";

/**
 * OpenAI API Proxy - Standard Model (gpt-4o)
 * Endpoint: /api/ai/chat/standard
 *
 * Purpose: Proxy requests to OpenAI's Chat Completions API
 * using the more capable gpt-4o model for complex queries.
 *
 * This will be fully implemented in issue #2.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Implement OpenAI API proxy
    // - Extract messages from request body
    // - Forward to OpenAI Chat Completions API
    // - Use gpt-4o model
    // - Return streaming response

    return NextResponse.json(
      {
        error: "Not implemented yet. See issue #2 for full implementation.",
        model: "gpt-4o",
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
