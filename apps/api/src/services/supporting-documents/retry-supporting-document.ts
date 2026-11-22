import type { Kysely } from "kysely";
import { listFailedDocumentChunksData } from "../../data/supporting-documents/list-failed-document-chunks.js";
import { listSupportingDocumentsData } from "../../data/supporting-documents/list-supporting-documents.js";
import { lockSupportingDocumentData } from "../../data/supporting-documents/lock-supporting-document.js";
import type { DB } from "../../db/types.js";
import { ensureBackgroundJobScheduledService } from "../background-jobs/enqueue-job.js";
import { toSupportingDocument } from "./supporting-document-dto.js";

export async function retrySupportingDocumentService(
  db: Kysely<DB>,
  documentId: string,
) {
  return db.transaction().execute(async (trx) => {
    const row = await lockSupportingDocumentData(trx, documentId);

    if (!row) return { status: 404 as const, message: "Document not found." };

    const [document] = await listSupportingDocumentsData(trx, documentId);

    if (!document || !toSupportingDocument(document).canRetry)
      return {
        status: 409 as const,
        message: "There is no failed work to retry.",
      };

    if (row.extraction_status === "pending") {
      await ensureBackgroundJobScheduledService(
        trx,
        "extract_supporting_document",
        { documentId },
      );
    } else {
      const rows = await listFailedDocumentChunksData(trx, documentId);

      for (const { id } of rows)
        await ensureBackgroundJobScheduledService(trx, "embed_document_chunk", {
          chunkId: id,
        });
    }

    const [updated] = await listSupportingDocumentsData(trx, documentId);

    if (!updated) throw new Error("Retried supporting document was not found");

    return toSupportingDocument(updated);
  });
}
