import { createHash } from "node:crypto";
import type { Selectable } from "kysely";
import type { MediaAssets } from "../../db/types.js";

export function catalogKnowledgeDigest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

// Version the exact preprocessing/model space so future changes require reindexing.
export const catalogKnowledgePipeline =
  "gemini-embedding-2:768:document-v1:webp-png-2048-v1";

export function catalogKnowledgeSourceHash(
  content: string,
  media:
    | Pick<
        Selectable<MediaAssets>,
        "source" | "storage_key" | "url" | "mime_type"
      >
    | undefined,
) {
  return `v1:${catalogKnowledgeDigest(
    JSON.stringify({
      pipeline: catalogKnowledgePipeline,
      content,
      media: media
        ? [media.source, media.storage_key, media.url, media.mime_type]
        : null,
    }),
  )}`;
}
