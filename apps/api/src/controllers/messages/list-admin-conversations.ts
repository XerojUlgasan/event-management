import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { conversationsSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listAdminConversationsService } from "../../services/messages/list-admin-conversations.js";

export const listAdminConversationsRoute = createRoute({
  method: "get",
  path: "/admin/conversations",
  tags: ["Messages"],
  summary: "List customer conversations for staff",
  responses: {
    200: { content: json(conversationsSchema), description: "Conversations with unread counts" },
    401: errors[401],
    403: errors[403],
  },
});
export const listAdminConversationsRouteHandler: AppRouteHandler<typeof listAdminConversationsRoute> = async (c) =>
  c.json({ conversations: await listAdminConversationsService(c.get("db")) }, 200)
;
