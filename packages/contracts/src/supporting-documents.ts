import { z } from "zod";

export const SUPPORTING_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const SUPPORTING_DOCUMENT_MAX_PAGES = 200;

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

export type SupportingDocument = z.infer<typeof supportingDocumentSchema>;

export type SupportingDocumentsResponse = z.infer<
  typeof supportingDocumentsResponseSchema
>;
