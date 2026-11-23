import { KNOWLEDGE_SEARCH_MAX_LENGTH } from "@event-management/contracts/catalog-knowledge";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  KnowledgeSearchUnavailable,
  searchCatalogKnowledgeService,
} from "../../services/ai/retrieval/search-catalog-knowledge.js";
import { errors, kindSchema, response } from "./schemas.js";

export const searchRoute = createRoute({
  method: "post",
  path: "/admin/ai/knowledge/search",
  tags: ["AI knowledge"],
  request: {
    body: {
      required: true,
      content: openapiJson(
        z.object({
          query: z.string().trim().min(1).max(KNOWLEDGE_SEARCH_MAX_LENGTH),
        }),
      ),
    },
  },
  responses: {
    200: response(
      z.object({
        query: z.string(),
        model: z.string(),
        results: z.array(
          z.object({
            listing: z.object({
              id: z.string(),
              kind: kindSchema,
              name: z.string(),
            }),
            key: z.string(),
            kind: z.enum(["text", "photo"]),
            contentMarkdown: z.string(),
            mediaUrl: z.string().nullable(),
            similarity: z.number(),
          }),
        ),
      }),
    ),
    503: { description: "Knowledge search is temporarily unavailable" },
    ...errors,
  },
});

export const searchRouteHandler: AppRouteHandler<typeof searchRoute> = async (
  c,
) => {
  try {
    return c.json(
      await searchCatalogKnowledgeService(
        c.get("db"),
        c.req.valid("json").query,
        c.req.raw.signal,
      ),
      200,
    );
  } catch (error) {
    if (error instanceof KnowledgeSearchUnavailable)
      return jsonError(c, "Knowledge search is temporarily unavailable", 503);

    throw error;
  }
};
