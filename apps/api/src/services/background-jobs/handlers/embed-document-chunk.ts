import type { Kysely } from "kysely";
import type { BackgroundJobLease } from "../../../data/background-jobs/assert-job-lease.js";
import type { DB } from "../../../db/types.js";
import { embedDocumentChunkService } from "../../supporting-documents/embed-document-chunk.js";

export function embedDocumentChunkJob(
  db: Kysely<DB>,
  payload: { chunkId: string },
  signal: AbortSignal,
  lease?: BackgroundJobLease,
) {
  return embedDocumentChunkService(db, payload.chunkId, signal, lease);
}
