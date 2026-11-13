import { paginationQuerySchema } from "../../utils/pagination.js";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { errors, idParams, json } from "./http.js";
import { getCustomerConversationByIdService } from "../../services/messages/get-customer-conversation-by-id.js";

export const getCustomerConversationByIdRoute = createRoute({
  method: "get",
  path: "/messages/conversations/{id}",
  tags: ["Messages"],
  summary: "Read one of the signed-in customer's conversations",
  request: { params: idParams, query: paginationQuerySchema },
  responses: {
    200: { content: json(threadSchema), description: "Conversation and messages" },
    ...errors,
  },
});

export const getCustomerConversationByIdRouteHandler: AppRouteHandler<typeof getCustomerConversationByIdRoute> = async (c) => {
  const result = await getCustomerConversationByIdService(
    c.get("db"),
    c.get("session").user.id,
    c.req.valid("param").id,
    c.req.valid("query").limit, c.req.valid("query").cursor,
  );
  return result ? c.json(result, 200) : c.json({ error: "Conversation not found" }, 404);
};