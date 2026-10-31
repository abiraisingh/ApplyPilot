import { env } from "../../config/env.js";
import { HttpError } from "../../shared/errors.js";

type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export async function completeAiChat(messages: AiMessage[], maxTokens: number): Promise<string> {
  if (!env.AI_BASE_URL || !env.AI_API_KEY) {
    throw new HttpError(503, "AI_NOT_CONFIGURED", "AI features are not configured on this server");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    let response: Response;
    try {
      response = await fetch(`${env.AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: env.AI_MODEL, messages, max_tokens: maxTokens, temperature: 0.3 }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new HttpError(504, "AI_TIMEOUT", "The AI provider took too long to respond. Please try again.");
      }
      throw new HttpError(502, "AI_UNAVAILABLE", "Could not connect to the configured AI provider");
    }

    if (!response.ok) {
      throw new HttpError(502, "AI_PROVIDER_ERROR", "The configured AI provider could not complete this request");
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new HttpError(502, "AI_INVALID_RESPONSE", "The AI provider returned an invalid response");
    }
    if (
      typeof payload !== "object" || payload === null ||
      !("choices" in payload) || !Array.isArray(payload.choices)
    ) {
      throw new HttpError(502, "AI_INVALID_RESPONSE", "The AI provider returned an unsupported response");
    }
    const content = payload.choices[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new HttpError(502, "AI_INVALID_RESPONSE", "The AI provider returned an empty response");
    }
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}
