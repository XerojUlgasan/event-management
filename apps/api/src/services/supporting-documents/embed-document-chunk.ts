import type { Kysely } from "kysely";
import { loadDocumentChunkForEmbeddingData } from "../../data/supporting-documents/load-document-chunk-for-embedding.js";
import { saveDocumentChunkEmbeddingData } from "../../data/supporting-documents/save-document-chunk-embedding.js";
import type { DB } from "../../db/types.js";
import {
  assertBackgroundJobLeaseData,
  type BackgroundJobLease,
} from "../../data/background-jobs/assert-job-lease.js";
import { embedCatalogContent } from "../ai/retrieval/embed-catalog-content.js";
import { documentSha256 } from "./document-storage.js";
import { supportingDocumentPipeline } from "./document-pipeline.js";

export async function embedDocumentChunkService(
  db: Kysely<DB>,
  chunkId: string,
  signal: AbortSignal,
  lease?: BackgroundJobLease,
) {
  const chunk = await loadDocumentChunkForEmbeddingData(db, chunkId);

  if (!chunk) return;

  if (!lease) throw new Error("Document embedding requires a job lease");

  const input = chunk.content_text;

  if (
    chunk.pipeline_version !== supportingDocumentPipeline ||
    documentSha256(input) !== chunk.content_hash
  )
    throw new Error("Document embedding input changed");

  signal.throwIfAborted();
  const { embedding, model } = await embedCatalogContent({
    contentMarkdown: input,
    abortSignal: signal,
  });
  await db.transaction().execute(async (trx) => {
    await assertBackgroundJobLeaseData(trx, lease, signal);
    await saveDocumentChunkEmbeddingData(trx, {
      chunkId,
      contentHash: chunk.content_hash,
      embedding,
      model,
    });
  });
}
