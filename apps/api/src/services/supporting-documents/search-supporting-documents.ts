import type { SupportingDocumentSearchResponse } from "@event-management/contracts/supporting-documents";
import type { Kysely } from "kysely";
import { searchSupportingDocumentsData } from "../../data/supporting-documents/search-supporting-documents.js";
import type { DB } from "../../db/types.js";
import { embedCatalogContent } from "../ai/retrieval/embed-catalog-content.js";

export class SupportingDocumentSearchUnavailable extends Error {}

export async function searchSupportingDocumentsService(
  db: Kysely<DB>,
  query: string,
  abortSignal: AbortSignal,
): Promise<SupportingDocumentSearchResponse> {
  let vector: Awaited<ReturnType<typeof embedCatalogContent>>;

  try {
    vector = await embedCatalogContent({
      contentMarkdown: query,
      purpose: "search",
      abortSignal,
    });
  } catch {
    throw new SupportingDocumentSearchUnavailable();
  }

  abortSignal.throwIfAborted();
  const rows = await searchSupportingDocumentsData(
    db,
    vector.embedding,
    vector.model,
  );

  return {
    results: rows.map((row) => ({
      id: row.id,
      filename: row.original_filename,
      pageStart: row.page_start,
      pageEnd: row.page_end,
      headingPath: row.heading_path,
      text: row.content_text,
      similarity: row.similarity,
      model: vector.model,
      // Extraction creates the chunk and schedules its first job atomically.
      createdAt: row.created_at?.toISOString() ?? null,
      embeddedAt: row.embedded_at.toISOString(),
    })),
  };
}
