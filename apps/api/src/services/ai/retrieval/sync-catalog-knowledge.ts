import { createHash } from "node:crypto";
import type { Transaction } from "kysely";
import type { DB } from "../../../db/types.js";
import {
  findCatalogKnowledgeMediaData,
  loadCatalogKnowledgeSourceData,
  lockCatalogKnowledgeOwnerData,
  reconcileCatalogKnowledgeData,
  type CatalogKnowledgeOwner,
} from "../../../data/ai/catalog-knowledge.js";
import { prepareCatalogKnowledge } from "./prepare-catalog-knowledge.js";
import type { MediaAssets } from "../../../db/types.js";
import type { Selectable } from "kysely";

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

export async function syncCatalogKnowledge(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
) {
  await lockCatalogKnowledgeOwnerData(trx, owner);
  const source = await loadCatalogKnowledgeSourceData(trx, owner);
  const prepared = source ? prepareCatalogKnowledge(source) : [];
  const chunks = [];
  for (const chunk of prepared) {
    const media = chunk.mediaId
      ? await findCatalogKnowledgeMediaData(trx, chunk.mediaId)
      : undefined;
    if (chunk.mediaId && !media)
      throw new Error("Catalog photo is unavailable");
    const sourceHash = catalogKnowledgeSourceHash(chunk.contentMarkdown, media);
    chunks.push({ ...chunk, sourceHash });
  }
  return reconcileCatalogKnowledgeData(trx, owner, chunks);
}
