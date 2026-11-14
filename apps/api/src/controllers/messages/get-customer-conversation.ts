import { paginationQuerySchema } from "../../utils/pagination.js";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { getCustomerConversationService } from "../../services/messages/get-customer-conversation.js";

export const getCustomerConversationRoute = createRoute({
  method: "get",
  path: "/messages/conversation",
  tags: ["Messages"],
  summary: "Read the signed-in customer's conversation with the Clemora team",
  request: { query: paginationQuerySchema },
  responses: {
    400: errors[400],
    200: {
      content: json(threadSchema),
      description: "Conversation and messages",
    },
    401: errors[401],
    403: errors[403],
  },
});
export const getCustomerConversationRouteHandler: AppRouteHandler<
  typeof getCustomerConversationRoute
> = async (c) => {
  return c.json(
    await getCustomerConversationService(
      c.get("db"),
      c.get("session").user.id,
      c.req.valid("query").limit,
      c.req.valid("query").cursor,
    ),
    200,
  );
};
