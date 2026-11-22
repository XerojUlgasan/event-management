import {
  supportingDocumentSearchRequestSchema,
  supportingDocumentSearchResponseSchema,
} from "@event-management/contracts/supporting-documents";
import { createRoute } from "@hono/zod-openapi";
import {
  searchSupportingDocumentsService,
  SupportingDocumentSearchUnavailable,
} from "../../services/supporting-documents/search-supporting-documents.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { errors, tags } from "./responses.js";

export const searchSupportingDocumentsRoute = createRoute({
  method: "post",
  path: "/admin/ai/documents/search",
  tags,
  request: {
    body: {
      required: true,
      content: openapiJson(supportingDocumentSearchRequestSchema),
    },
  },
  responses: {
    200: {
      description: "Ranked document passages",
      content: openapiJson(supportingDocumentSearchResponseSchema),
    },
    503: { description: "Document search is temporarily unavailable" },
    ...errors,
  },
});

export const searchSupportingDocumentsRouteHandler: AppRouteHandler<
  typeof searchSupportingDocumentsRoute
> = async (c) => {
  try {
    return c.json(
      await searchSupportingDocumentsService(
        c.get("db"),
        c.req.valid("json").query,
        c.req.raw.signal,
      ),
      200,
    );
  } catch (error) {
    if (error instanceof SupportingDocumentSearchUnavailable)
      return jsonError(
        c,
        "Document search is temporarily unavailable. Try again.",
        503,
      );

    throw error;
  }
};
