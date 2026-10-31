import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { z } from "@hono/zod-openapi";
import { adminConversationsPageSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { decodeAdminConversationsCursor, listAdminConversationsService } from "../../services/messages/list-admin-conversations.js";

export const listAdminConversationsRoute = createRoute({
  method: "get",
  path: "/admin/conversations",
  tags: ["Messages"],
  summary: "List customer conversations for staff",
  request: { query: z.object({ cursor: z.string().refine((value) => !!decodeAdminConversationsCursor(value), "Invalid cursor").optional() }) },
  responses: {
    200: { content: json(adminConversationsPageSchema), description: "Conversations with unread counts" },
    400: errors[400],
    401: errors[401],
    403: errors[403],
  },
});
export const listAdminConversationsRouteHandler: AppRouteHandler<typeof listAdminConversationsRoute> = async (c) => {
  const { cursor } = c.req.valid("query");
  return c.json(await listAdminConversationsService(c.get("db"), cursor ? decodeAdminConversationsCursor(cursor) : undefined), 200);
};
