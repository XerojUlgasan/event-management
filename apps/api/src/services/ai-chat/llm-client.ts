/**
 * LLM client — the single provider-agnostic interface for AI chat.
 *
 * The rest of the codebase calls `callLLM(messages)` and gets a string back.
 * To switch providers (Gemini → OpenAI → Anthropic, etc.), replace the
 * implementation in this one file. The service layer, controllers, and
 * schemas never import a provider-specific name.
 *
 * Current provider: Google Gemini (generateContent API).
 * Config: GEMINI_API_KEY, GEMINI_MODEL (env vars).
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class LLMNotConfiguredError extends Error {
  constructor() {
    super("AI provider API key is not configured");
    this.name = "LLMNotConfiguredError";
  }
}

export class LLMError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/** Timeout for the LLM API call (ms). */
const LLM_TIMEOUT_MS = 60_000;

/**
 * Sends a chat-completion request to the configured LLM provider.
 * Accepts a standard message array (system/user/assistant) and returns
 * the generated text. Uses native fetch so it runs in both Node and Edge.
 */
export async function callLLM(messages: ChatMessage[]): Promise<string> {
  // ── Provider: Gemini ──────────────────────────────────────────────
  // To switch providers, replace everything below this comment with the
  // new provider's API call. The ChatMessage type and error classes
  // above stay the same; callers are unaffected.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError();

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  type GeminiContent = {
    role: "user" | "model";
    parts: Array<{ text: string }>;
  };

  type GeminiRequest = {
    system_instruction?: { parts: Array<{ text: string }> };
    contents: GeminiContent[];
    generationConfig: {
      maxOutputTokens: number;
      temperature: number;
      thinkingConfig?: { thinkingBudget: number };
    };
  };

  type GeminiResponse = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    error?: { code: number; message: string };
  };

  // Extract the system prompt (must come first and have role "system").
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  // Gemini requires turns to alternate user/model and start with user.
  // Consecutive same-role messages are merged to satisfy this constraint.
  const contents: GeminiContent[] = [];
  for (const msg of conversationMessages) {
    const geminiRole = msg.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === geminiRole) {
      last.parts.push({ text: msg.content });
    } else {
      contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
  }

  const requestBody: GeminiRequest = {
    contents,
    generationConfig: {
      maxOutputTokens: 600,
      temperature: 0.4,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  if (systemMessage) {
    requestBody.system_instruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new LLMError(408, "AI request timed out");
    }
    throw err;
  }
  clearTimeout(timeout);

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok || data.error) {
    const msg = data.error?.message ?? `HTTP ${response.status}`;
    throw new LLMError(
      data.error?.code ?? response.status,
      `AI request failed: ${msg}`,
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new LLMError(200, "AI returned an empty reply");
  return text;
}
