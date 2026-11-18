import { paginationQuerySchema } from "../../utils/pagination.js";
import { jsonError } from "../../utils/service-result.js";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { json, errors, idParams } from "./http.js";
import { getAdminConversationService } from "../../services/messages/get-admin-conversation.js";

export const getAdminConversationRoute = createRoute({
  method: "get",
  path: "/admin/conversations/{id}",
  tags: ["Messages"],
  summary: "Read a customer conversation as an admin",
  request: { params: idParams, query: paginationQuerySchema },
  responses: {
    200: {
      content: json(threadSchema),
      description: "Conversation and messages",
    },
    ...errors,
  },
});
export const getAdminConversationRouteHandler: AppRouteHandler<
  typeof getAdminConversationRoute
> = async (c) => {
  const result = await getAdminConversationService(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("query").limit,
    c.req.valid("query").cursor,
  );
  return result
    ? c.json(result, 200)
    : jsonError(c, "Conversation not found", 404);
};
