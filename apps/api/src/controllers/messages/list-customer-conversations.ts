import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { conversationsSchema } from "./schemas.js";
import { errors, json } from "./http.js";
import { listCustomerConversationsService } from "../../services/messages/list-customer-conversations.js";

export const listCustomerConversationsRoute = createRoute({
  method: "get",
  path: "/messages/conversations",
  tags: ["Messages"],
  summary: "List the signed-in customer's conversations",
  responses: {
    200: { content: json(conversationsSchema), description: "Customer conversations" },
    401: errors[401],
    403: errors[403],
  },
});

export const listCustomerConversationsRouteHandler: AppRouteHandler<typeof listCustomerConversationsRoute> = async (c) =>
  c.json({ conversations: await listCustomerConversationsService(c.get("db"), c.get("session").user.id) }, 200);