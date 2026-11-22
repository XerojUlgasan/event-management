import { createRoute, z } from "@hono/zod-openapi";
import { deleteSupportingDocumentService } from "../../services/supporting-documents/delete-supporting-document.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { errors, tags } from "./responses.js";

export const deleteSupportingDocumentRoute = createRoute({
  method: "delete",
  path: "/admin/ai/documents/{id}",
  tags,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: "Document and embeddings deleted" },
    502: { description: "Could not delete the stored PDF" },
    ...errors,
  },
});

export const deleteSupportingDocumentRouteHandler: AppRouteHandler<
  typeof deleteSupportingDocumentRoute
> = async (c) => {
  const result = await deleteSupportingDocumentService(
    c.get("db"),
    c.req.valid("param").id,
  );

  if (result) return jsonError(c, result.message, result.status);

  return c.body(null, 204);
};
