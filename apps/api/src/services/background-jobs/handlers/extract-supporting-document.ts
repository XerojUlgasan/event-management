import type { Kysely } from "kysely";
import type { BackgroundJobLease } from "../../../data/background-jobs/assert-job-lease.js";
import type { DB } from "../../../db/types.js";
import { extractSupportingDocumentService } from "../../supporting-documents/extract-supporting-document.js";

export function extractSupportingDocumentJob(
  db: Kysely<DB>,
  payload: { documentId: string },
  signal: AbortSignal,
  lease?: BackgroundJobLease,
) {
  return extractSupportingDocumentService(
    db,
    payload.documentId,
    signal,
    lease,
  );
}
