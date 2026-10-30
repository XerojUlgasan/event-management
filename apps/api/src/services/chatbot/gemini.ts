import type { ChatTurn } from "./context.js";

export class GeminiUnavailableError extends Error {}

const UNAVAILABLE =
  "The Clemora assistant is unavailable right now. Please try again, or ask to speak with our team.";

// Gemini retires model names and individual models occasionally return 503
// during demand spikes. Try the configured model first, then recent fallbacks.
const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-flash-lite-latest", "gemini-3.8-flash"];
// Each model gets its own budget so one slow model cannot stall the whole reply.
const MODEL_TIMEOUT_MS = 12_000;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function modelCandidates() {
  const configured = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return [...new Set([configured, ...FALLBACK_MODELS])];
}

export async function generateGeminiReply(systemPrompt: string, turns: ChatTurn[]) {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiUnavailableError(UNAVAILABLE);
  }
  for (const model of modelCandidates()) {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: turns.map((turn) => ({
              role: turn.role,
              parts: [{ text: turn.text }],
            })),
            // Thinking tokens count toward this budget, so keep headroom for the
            // visible answer instead of truncating mid-sentence.
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
          }),
          signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        },
      );
    } catch (cause) {
      // Log the API detail (never the key) so a bad model or network issue is visible locally.
      console.warn(
        `Gemini model ${model} request failed:`,
        cause instanceof Error ? cause.message : cause,
      );
      continue;
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      console.warn(`Gemini model ${model} failed (${response.status}): ${detail}`);
      continue;
    }
    const data = (await response.json().catch(() => null)) as GeminiResponse | null;
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      console.warn(`Gemini model ${model} returned no text`);
      continue;
    }
    if (model !== (process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL)) {
      console.info(`Gemini reply served by fallback model ${model}`);
    }
    return text.slice(0, 4000);
  }
  throw new GeminiUnavailableError(UNAVAILABLE);
}
