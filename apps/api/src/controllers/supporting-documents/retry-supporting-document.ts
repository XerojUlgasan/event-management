import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { retrySupportingDocumentService } from "../../services/supporting-documents/retry-supporting-document.js";
import { jsonError } from "../../utils/service-result.js";
import { accepted, errors, tags } from "./responses.js";

export const retrySupportingDocumentRoute = createRoute({
  method: "post",
  path: "/admin/ai/documents/{id}/retry",
  tags,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    202: accepted,
    404: { description: "Document not found" },
    409: { description: "Nothing to retry" },
    ...errors,
  },
});

export const retrySupportingDocumentRouteHandler: AppRouteHandler<
  typeof retrySupportingDocumentRoute
> = async (c) => {
  const result = await retrySupportingDocumentService(
    c.get("db"),
    c.req.valid("param").id,
  );

  if ("status" in result) return jsonError(c, result.message, result.status);

  return c.json(result, 202);
};
