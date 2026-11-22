import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { uploadSupportingDocumentService } from "../../services/supporting-documents/upload-supporting-document.js";
import { jsonError } from "../../utils/service-result.js";
import { accepted, errors, tags } from "./responses.js";

export const uploadSupportingDocumentRoute = createRoute({
  method: "post",
  path: "/admin/ai/documents",
  tags,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file"],
            properties: { file: { type: "string", format: "binary" } },
          },
        },
      },
    },
  },
  responses: {
    202: accepted,
    413: { description: "File too large" },
    502: { description: "Storage unavailable" },
    ...errors,
  },
});

export const uploadSupportingDocumentRouteHandler: AppRouteHandler<
  typeof uploadSupportingDocumentRoute
> = async (c) => {
  const form = await c.req.raw.formData().catch(() => null);

  const file = form?.get("file");

  if (!(file instanceof File) || form?.getAll("file").length !== 1)
    return jsonError(c, "Choose one PDF file.", 400);

  const result = await uploadSupportingDocumentService(
    c.get("db"),
    c.get("session").user.id,
    file,
  );

  if ("status" in result) return jsonError(c, result.message, result.status);

  return c.json(result, 202);
};
