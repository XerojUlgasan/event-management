import { createGateway, embed } from "ai";
import { env } from "../../../utils/env.js";

const supportedModel = "google/gemini-embedding-2";
const dimensions = 768;

export async function embedCatalogContent({
  contentMarkdown = "",
  image,
  abortSignal,
  purpose = "document",
}: {
  contentMarkdown?: string;
  image?: { bytes: Uint8Array; mimeType: string };
  abortSignal?: AbortSignal;
  purpose?: "document" | "search";
}): Promise<{ embedding: number[]; model: string }> {
  const { apiKey, model } = env.AI_EMBEDDING;

  if (model !== supportedModel) throw new Error("Unsupported embedding model");

  if (!contentMarkdown.trim() && !(purpose === "search" && image))
    throw new Error("Embedding content is empty");

  if (
    image &&
    (!image.bytes.length ||
      !["image/jpeg", "image/png"].includes(image.mimeType))
  ) {
    throw new Error("Unsupported embedding image");
  }

  const signal = AbortSignal.timeout(30_000);
  const { embedding } = await embed({
    model: createGateway({ apiKey }).embeddingModel(model),
    value:
      purpose === "document"
        ? `title: none | text: ${contentMarkdown}`
        : image
          ? contentMarkdown
          : `task: search result | query: ${contentMarkdown}`,
    dimensions,
    maxRetries: 0,
    abortSignal: abortSignal ? AbortSignal.any([signal, abortSignal]) : signal,
    ...(image && {
      providerOptions: {
        google: {
          content: [
            [
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: Buffer.from(image.bytes).toString("base64"),
                },
              },
            ],
          ],
        },
      },
    }),
  });

  if (embedding.length !== dimensions || !embedding.every(Number.isFinite)) {
    throw new Error("Invalid embedding vector");
  }

  const norm = Math.hypot(...embedding);

  if (!Number.isFinite(norm) || norm === 0)
    throw new Error("Invalid embedding vector");

  return { embedding: embedding.map((value) => value / norm), model };
}
