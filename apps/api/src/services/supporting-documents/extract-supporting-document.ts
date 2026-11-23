import type { Kysely } from "kysely";
import { createDocumentChunksData } from "../../data/supporting-documents/create-document-chunks.js";
import { loadSupportingDocumentForExtractionData } from "../../data/supporting-documents/load-supporting-document-for-extraction.js";
import { lockSupportingDocumentData } from "../../data/supporting-documents/lock-supporting-document.js";
import { saveSupportingDocumentExtractionData } from "../../data/supporting-documents/save-supporting-document-extraction.js";
import type { DB } from "../../db/types.js";
import {
  assertBackgroundJobLeaseData,
  type BackgroundJobLease,
} from "../../data/background-jobs/assert-job-lease.js";
import { enqueueNewBackgroundJobsService } from "../background-jobs/enqueue-job.js";
import { documentSha256, readSupportingDocument } from "./document-storage.js";
import { supportingDocumentPipeline } from "./document-pipeline.js";
import { prepareSupportingDocument } from "./prepare-document.js";

export async function extractSupportingDocumentService(
  db: Kysely<DB>,
  documentId: string,
  signal: AbortSignal,
  lease?: BackgroundJobLease,
) {
  const source = await loadSupportingDocumentForExtractionData(db, documentId);

  if (!source) return;

  if (!lease) throw new Error("Document extraction requires a job lease");

  if (source.pipeline_version !== supportingDocumentPipeline)
    throw new Error("Unsupported document pipeline");

  const bytes = await readSupportingDocument(source.storage_key, signal);
  const result =
    documentSha256(bytes) === source.file_sha256
      ? await prepareSupportingDocument(bytes, signal)
      : { kind: "failed" as const, code: "file_changed" };

  await db.transaction().execute(async (trx) => {
    await assertBackgroundJobLeaseData(trx, lease, signal);
    const locked = await lockSupportingDocumentData(trx, documentId, {
      extractionStatus: "pending",
    });

    if (!locked) return;

    if (
      result.kind === "failed" ||
      (result.kind === "complete" && !result.chunks.length)
    ) {
      await saveSupportingDocumentExtractionData(trx, documentId, {
        extraction_status: "failed",
        extraction_error_code:
          result.kind === "failed" ? result.code : "empty_document",
      });

      return;
    }

    if (result.kind === "needs_review") {
      await saveSupportingDocumentExtractionData(trx, documentId, {
        extraction_status: "needs_review",
        page_count: result.pageCount,
        unreadable_pages: result.unreadablePages,
        extraction_error_code: "unreadable_pages",
      });

      return;
    }

    const chunks = await createDocumentChunksData(
      trx,
      result.chunks.map((chunk) => ({
        document_id: documentId,
        ordinal: chunk.ordinal,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        heading_path: chunk.headingPath,
        content_text: chunk.contentText,
        content_hash: documentSha256(chunk.contentText),
        embedding: null,
        embedding_model: null,
        embedded_at: null,
      })),
    );

    await saveSupportingDocumentExtractionData(trx, documentId, {
      extraction_status: "complete",
      page_count: result.pageCount,
    });
    await enqueueNewBackgroundJobsService(
      trx,
      "embed_document_chunk",
      chunks.map(({ id }) => ({ chunkId: id })),
    );
  });
}
