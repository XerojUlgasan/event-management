import { paginationQuerySchema } from "../../utils/pagination.js";
import { z } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { customerConversationsSchema } from "./schemas.js";
import { errors, json } from "./http.js";
import { listCustomerConversationsService } from "../../services/messages/list-customer-conversations.js";

export const listCustomerConversationsRoute = createRoute({
  method: "get",
  path: "/messages/conversations",
  tags: ["Messages"],
  summary: "List the signed-in customer's conversations",
  request: {
    query: paginationQuerySchema.extend({
      reference: z.string().min(1).max(100).optional(),
      includeLatestBookingDraft: z.literal("1").optional(),
    }),
  },
  responses: {
    400: errors[400],
    200: {
      content: json(customerConversationsSchema),
      description: "Customer conversations",
    },
    401: errors[401],
    403: errors[403],
  },
});

export const listCustomerConversationsRouteHandler: AppRouteHandler<
  typeof listCustomerConversationsRoute
> = async (c) => {
  const { limit, cursor, reference, includeLatestBookingDraft } =
    c.req.valid("query");

  return c.json(
    await listCustomerConversationsService(
      c.get("db"),
      c.get("session").user.id,
      limit,
      cursor,
      reference,
      includeLatestBookingDraft === "1",
    ),
    200,
  );
};
