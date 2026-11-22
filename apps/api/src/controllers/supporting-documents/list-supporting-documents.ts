import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { supportingDocumentsResponseSchema } from "@event-management/contracts/supporting-documents";
import { listSupportingDocumentsService } from "../../services/supporting-documents/list-supporting-documents.js";
import { openapiJson } from "../../utils/openapi.js";
import { errors, tags } from "./responses.js";

export const listSupportingDocumentsRoute = createRoute({
  method: "get",
  path: "/admin/ai/documents",
  tags,
  responses: {
    200: {
      description: "Supporting documents",
      content: openapiJson(supportingDocumentsResponseSchema),
    },
    ...errors,
  },
});

export const listSupportingDocumentsRouteHandler: AppRouteHandler<
  typeof listSupportingDocumentsRoute
> = async (c) =>
  c.json({ documents: await listSupportingDocumentsService(c.get("db")) }, 200);
