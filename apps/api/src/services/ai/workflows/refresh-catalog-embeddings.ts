import type { Kysely } from "kysely";
import { APICallError } from "ai";
import type { DB } from "../../../db/types.js";
import { findCatalogKnowledgeMediaData } from "../../../data/ai/find-catalog-knowledge-media.js";
import { saveCatalogKnowledgeEmbeddingData } from "../../../data/ai/save-catalog-knowledge-embedding.js";
import { setCatalogKnowledgeInputHashData } from "../../../data/ai/set-catalog-knowledge-input-hash.js";
import type { CatalogKnowledgeOwner } from "../../../data/ai/catalog-knowledge-types.js";
import { env } from "../../../utils/env.js";
import { embedCatalogContent } from "../retrieval/embed-catalog-content.js";
import { readCatalogEmbeddingImage } from "../retrieval/read-catalog-embedding-image.js";
import { syncCatalogKnowledge } from "./sync-catalog-knowledge.js";
import { catalogKnowledgeDigest } from "../catalog-knowledge-hash.js";

export async function refreshCatalogEmbeddingsService({
  db,
  owner,
  abortSignal,
}: {
  db: Kysely<DB>;
  owner: CatalogKnowledgeOwner;
  abortSignal?: AbortSignal;
}) {
  const rows = await db
    .transaction()
    .execute((trx) => syncCatalogKnowledge(trx, owner));
  const result = { embedded: 0, unchanged: 0, superseded: 0, failed: 0 };
  if (!rows.length) return result;
  const { model } = env.AI_EMBEDDING;
  if (model !== "google/gemini-embedding-2")
    throw new Error("Unsupported embedding model");
  for (const row of rows) {
    abortSignal?.throwIfAborted();
    try {
      const sourceHash = row.content_hash.split(":").slice(0, 2).join(":");
      const photoSignal = AbortSignal.timeout(30_000);
      const signal = abortSignal
        ? AbortSignal.any([photoSignal, abortSignal])
        : photoSignal;
      const media = row.media_id
        ? await findCatalogKnowledgeMediaData(db, row.media_id)
        : undefined;
      if (row.media_id && !media)
        throw new Error("Catalog photo is unavailable");
      const image = media
        ? await readCatalogEmbeddingImage(media, signal)
        : undefined;
      const inputHash = `${sourceHash}:${catalogKnowledgeDigest(image ? image.bytes : row.content_markdown)}`;
      const stage = await db.transaction().execute(async (trx) => {
        const current = (await syncCatalogKnowledge(trx, owner)).find(
          (item) => item.id === row.id,
        );
        if (!current || !current.content_hash.startsWith(sourceHash))
          return "superseded";
        if (
          current.content_hash === inputHash &&
          current.embedding &&
          current.embedding_model === model
        )
          return "unchanged";
        return (await setCatalogKnowledgeInputHashData(
          trx,
          row.id,
          current.content_hash,
          inputHash,
        ))
          ? "pending"
          : "superseded";
      });
      if (stage !== "pending") {
        result[stage]++;
        continue;
      }
      const vector = await embedCatalogContent({
        contentMarkdown: row.content_markdown,
        image,
        abortSignal,
      });
      abortSignal?.throwIfAborted();
      const saved = await db.transaction().execute(async (trx) => {
        const current = (await syncCatalogKnowledge(trx, owner)).find(
          (item) => item.id === row.id,
        );
        if (!current || current.content_hash !== inputHash) return false;
        return saveCatalogKnowledgeEmbeddingData(
          trx,
          row.id,
          inputHash,
          vector,
        );
      });
      result[saved ? "embedded" : "superseded"]++;
    } catch (cause) {
      abortSignal?.throwIfAborted();
      result.failed++;
      // Retain pending content for retry. Never log provider payloads or source text.
      console.warn("catalog-embedding", {
        ownerKind: owner.kind,
        ownerId: owner.id,
        chunkId: row.id,
        outcome: "failed",
        statusCode: APICallError.isInstance(cause)
          ? cause.statusCode
          : undefined,
      });
    }
  }
  return result;
}
