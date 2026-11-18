import { z } from "@hono/zod-openapi";
import { openapiJson } from "../../utils/openapi.js";
export const kindSchema = z.enum(["package", "service"]);
export const statusSchema = z.enum([
  "indexed",
  "partial",
  "pending",
  "needs-refresh",
]);
export const listingSchema = z.object({
  id: z.string(),
  kind: kindSchema,
  name: z.string(),
  status: statusSchema,
  indexedChunks: z.number().int(),
  expectedChunks: z.number().int(),
  textChunks: z.number().int(),
  photoChunks: z.number().int(),
  lastIndexedAt: z.string().nullable(),
});
export const summarySchema = z.object({
  packages: z.object({ total: z.number().int(), indexed: z.number().int() }),
  services: z.object({ total: z.number().int(), indexed: z.number().int() }),
  attention: z.number().int(),
  total: z.number().int(),
});
export const chunkSchema = z.object({
  key: z.string(),
  kind: z.enum(["text", "photo"]),
  withdrawn: z.boolean(),
  status: z.enum(["indexed", "pending", "needs-refresh"]),
  contentMarkdown: z.string(),
  mediaUrl: z.string().nullable(),
  embeddedAt: z.string().nullable(),
});
export const errors = {
  401: { description: "Not signed in" },
  403: { description: "Admin access required" },
  400: { description: "Invalid request or cursor" },
};
export const response = (schema: z.ZodType) => ({
  content: openapiJson(schema),
  description: "Knowledge catalog",
});
