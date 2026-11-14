import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { adminConversationsPageSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listAdminConversationsService } from "../../services/messages/list-admin-conversations.js";

export const listAdminConversationsRoute = createRoute({
  method: "get",
  path: "/admin/conversations",
  tags: ["Messages"],
  summary: "List customer conversations for admins",
  request: { query: paginationQuerySchema },
  responses: {
    200: {
      content: json(adminConversationsPageSchema),
      description: "Conversations with unread counts",
    },
    400: errors[400],
    401: errors[401],
    403: errors[403],
  },
});
export const listAdminConversationsRouteHandler: AppRouteHandler<
  typeof listAdminConversationsRoute
> = async (c) => {
  const { limit, cursor } = c.req.valid("query");
  return c.json(
    await listAdminConversationsService(c.get("db"), limit, cursor),
    200,
  );
};
