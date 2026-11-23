import type { SupportingDocument } from "@event-management/contracts/supporting-documents";
import type { SupportingDocumentProgressRow } from "../../data/supporting-documents/list-supporting-documents.js";

function documentProblem(code: string | null): SupportingDocument["problem"] {
  switch (code) {
    case "encrypted_pdf":
      return "encrypted";
    case "empty_document":
      return "no_text";
    case "page_limit_exceeded":
      return "page_limit";
    default:
      return null;
  }
}

function documentState(
  row: SupportingDocumentProgressRow,
): SupportingDocument["state"] {
  switch (row.extraction_status) {
    case "needs_review":
      return "needs_review";
    case "failed":
      return "failed";
    case "pending":
      return row.extraction_job_status === "failed" ? "failed" : "extracting";
    default:
      if (!row.chunk_count) return "failed";

      if (row.embedded_count === row.chunk_count) return "ready";

      return row.embedded_count + row.failed_count === row.chunk_count
        ? "failed"
        : "embedding";
  }
}

export function toSupportingDocument(
  row: SupportingDocumentProgressRow,
): SupportingDocument {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    byteSize: row.byte_size,
    createdAt: row.created_at.toISOString(),
    pageCount: row.page_count,
    unreadablePages: row.unreadable_pages,
    state: documentState(row),
    chunkCount: row.chunk_count,
    embeddedCount: row.embedded_count,
    failedCount: row.failed_count,
    canRetry:
      row.failed_count > 0 ||
      (row.extraction_status === "pending" &&
        row.extraction_job_status === "failed"),
    problem: documentProblem(row.extraction_error_code),
  };
}
