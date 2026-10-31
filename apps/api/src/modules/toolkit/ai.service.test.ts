import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { completeAiChat } from "./ai.service.js";

const originalConfig = {
  baseUrl: env.AI_BASE_URL,
  apiKey: env.AI_API_KEY,
  model: env.AI_MODEL,
};

afterEach(() => {
  env.AI_BASE_URL = originalConfig.baseUrl;
  env.AI_API_KEY = originalConfig.apiKey;
  env.AI_MODEL = originalConfig.model;
  vi.unstubAllGlobals();
});

describe("AI provider adapter", () => {
  it("uses the configured OpenAI-compatible chat-completions endpoint", async () => {
    env.AI_BASE_URL = "https://ai.example/v1/";
    env.AI_API_KEY = "test-key";
    env.AI_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "A useful response" } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeAiChat([{ role: "user", content: "Question" }], 100))
      .resolves.toBe("A useful response");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: "test-model",
      max_tokens: 100,
    });
  });

  it("returns an explicit configuration error when AI is disabled", async () => {
    env.AI_BASE_URL = "";
    env.AI_API_KEY = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeAiChat([{ role: "user", content: "Question" }], 100))
      .rejects.toMatchObject({ status: 503, code: "AI_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
