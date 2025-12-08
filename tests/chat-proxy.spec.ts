import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as chatMini } from "@/app/api/ai/chat/mini/route";
import { POST as chatStandard } from "@/app/api/ai/chat/standard/route";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCompletion = (model: string) => ({
  id: "test-chat",
  model,
  choices: [
    {
      message: {
        role: "assistant",
        content: `hello from ${model}`,
      },
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
});

const mockState = vi.hoisted(() => {
  const allowRateLimitDefault = {
    allowed: true,
    limit: 100,
    remaining: 99,
    resetAt: Date.now() + 60 * 60 * 1000,
  };

  const exceededRateLimit = {
    allowed: false,
    limit: 100,
    remaining: 0,
    resetAt: Date.now() + 60 * 60 * 1000,
  };

  const createChatCompletionMock = vi.fn(
    async (model: "gpt-4o" | "gpt-4o-mini") => mockCompletion(model)
  );

  const checkRateLimitMock = vi.fn(async () => allowRateLimitDefault);
  const getRateLimitHeadersMock = vi.fn(() => ({}));
  const getRateLimitHeadersCombinedMock = vi.fn(() => ({}));

  return {
    allowRateLimitDefault,
    exceededRateLimit,
    createChatCompletionMock,
    checkRateLimitMock,
    getRateLimitHeadersMock,
    getRateLimitHeadersCombinedMock,
  };
});

vi.mock("@/lib/openai", () => {
  return {
    createChatCompletion: mockState.createChatCompletionMock,
    calculateCost: vi.fn(() => 0),
  };
});

vi.mock("@/lib/rate-limit", () => {
  return {
    checkRateLimit: mockState.checkRateLimitMock,
    getRateLimitHeaders: mockState.getRateLimitHeadersMock,
    getRateLimitHeadersCombined: mockState.getRateLimitHeadersCombinedMock,
  };
});

const SECRET = "test-secret";

function buildSignedRequest(
  body: unknown,
  options?: { timestamp?: string; signature?: string; includeSignature?: boolean; deviceToken?: string }
) {
  const timestamp =
    options?.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const signature =
    options?.signature ??
    createHmac("sha256", SECRET)
      .update(JSON.stringify(body) + timestamp)
      .digest("hex");

  const headers = new Headers({
    "content-type": "application/json",
    "x-request-timestamp": timestamp,
  });

  if (options?.includeSignature !== false) {
    headers.set("x-request-signature", signature);
  }

  if (options?.deviceToken) {
    headers.set("x-device-token", options.deviceToken);
  }

  return new NextRequest("http://localhost/api/ai/chat/mini", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const validBody = {
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Say hi" },
  ],
  temperature: 0.2,
};

beforeEach(() => {
  process.env.HMAC_SECRET = SECRET;
  mockState.checkRateLimitMock.mockResolvedValue(mockState.allowRateLimitDefault);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chat proxy HMAC and rate limiting", () => {
  it("allows a valid signed request (mini)", async () => {
    const request = buildSignedRequest(validBody, {
      deviceToken: "device-123",
    });

    const response = await chatMini(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.choices?.[0]?.message?.content).toContain("gpt-4o-mini");
    expect(mockState.createChatCompletionMock).toHaveBeenCalledWith(
      "gpt-4o-mini",
      validBody
    );
    expect(mockState.checkRateLimitMock).toHaveBeenCalled();
  });

  it("allows a valid signed request (standard)", async () => {
    const request = buildSignedRequest(validBody);

    const response = await chatStandard(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.choices?.[0]?.message?.content).toContain("gpt-4o");
    expect(mockState.createChatCompletionMock).toHaveBeenCalledWith(
      "gpt-4o",
      validBody
    );
  });

  it("rejects when signature is missing", async () => {
    const request = buildSignedRequest(validBody, { includeSignature: false });

    const response = await chatMini(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Missing authentication headers");
  });

  it("rejects when timestamp is expired", async () => {
    const expiredTimestamp = Math.floor(
      (Date.now() - 6 * 60 * 1000) / 1000
    ).toString();
    const request = buildSignedRequest(validBody, {
      timestamp: expiredTimestamp,
    });

    const response = await chatMini(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Request timestamp invalid or expired");
  });

  it("rejects when rate limit is exceeded", async () => {
    mockState.checkRateLimitMock.mockResolvedValueOnce(
      mockState.exceededRateLimit
    );
    const request = buildSignedRequest(validBody);

    const response = await chatMini(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toBe("Rate limit exceeded");
  });
});
