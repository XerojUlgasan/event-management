import { z } from "zod";

export const SUPPORTING_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const SUPPORTING_DOCUMENT_MAX_PAGES = 200;
export const SUPPORTING_DOCUMENT_SEARCH_MAX_LENGTH = 500;
export const SUPPORTING_DOCUMENT_SEARCH_LIMIT = 5;

export const supportingDocumentSchema = z.strictObject({
  id: z.uuid(),
  originalFilename: z.string(),
  byteSize: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  pageCount: z.number().int().positive().nullable(),
  unreadablePages: z.array(z.number().int().positive()),
  state: z.enum(["extracting", "embedding", "ready", "needs_review", "failed"]),
  chunkCount: z.number().int().nonnegative(),
  embeddedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  canRetry: z.boolean(),
  problem: z.enum(["encrypted", "no_text", "page_limit"]).nullable(),
});

export const supportingDocumentsResponseSchema = z.strictObject({
  documents: z.array(supportingDocumentSchema),
});

export const supportingDocumentSearchRequestSchema = z.strictObject({
  query: z.string().trim().min(1).max(SUPPORTING_DOCUMENT_SEARCH_MAX_LENGTH),
});

const supportingDocumentMatchSchema = z.strictObject({
  id: z.uuid(),
  filename: z.string(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  headingPath: z.array(z.string()),
  text: z.string(),
  similarity: z.number(),
  model: z.string(),
  createdAt: z.iso.datetime().nullable(),
  embeddedAt: z.iso.datetime(),
});

export const supportingDocumentSearchResponseSchema = z.strictObject({
  results: z
    .array(supportingDocumentMatchSchema)
    .max(SUPPORTING_DOCUMENT_SEARCH_LIMIT),
});

export type SupportingDocumentMatch = z.infer<
  typeof supportingDocumentMatchSchema
>;

export type SupportingDocumentSearchResponse = z.infer<
  typeof supportingDocumentSearchResponseSchema
>;

export type SupportingDocument = z.infer<typeof supportingDocumentSchema>;

export type SupportingDocumentsResponse = z.infer<
  typeof supportingDocumentsResponseSchema
>;
