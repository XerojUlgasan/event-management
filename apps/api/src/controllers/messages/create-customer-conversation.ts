import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { errors, json } from "./http.js";
import { createCustomerConversationService } from "../../services/messages/create-customer-conversation.js";

export const createCustomerConversationRoute = createRoute({
  method: "post",
  path: "/messages/conversations",
  tags: ["Messages"],
  summary: "Start a new customer conversation",
  responses: {
    201: { content: json(threadSchema), description: "New conversation" },
    401: errors[401],
    403: errors[403],
  },
});

export const createCustomerConversationRouteHandler: AppRouteHandler<typeof createCustomerConversationRoute> = async (c) =>
  c.json(await createCustomerConversationService(c.get("db"), c.get("session").user.id), 201);