import { createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { AppRouteHandler } from "../../types/hono.js";
import { GUEST_COOKIE } from "../../utils/guest-chat.js";
import { errors, guestThreadSchema } from "./schemas.js";
import { idParams, json } from "../messages/http.js";
import { getGuestChatService } from "../../services/guest-chat/get-conversation.js";
import { paginationQuerySchema } from "../../utils/pagination.js";

export const getGuestConversationRoute = createRoute({
  method: "get",
  path: "/guest/conversations/{id}",
  tags: ["Guest chat"],
  summary: "Read the current anonymous conversation",
  request: { params: idParams, query: paginationQuerySchema },
  responses: {
    200: {
      content: json(guestThreadSchema),
      description: "Anonymous conversation",
    },
    ...errors,
  },
});
export const getGuestConversationRouteHandler: AppRouteHandler<
  typeof getGuestConversationRoute
> = async (c) => {
  const { limit, cursor } = c.req.valid("query");
  return c.json(
    await getGuestChatService(
      c.get("db"),
      c.req.valid("param").id,
      getCookie(c, GUEST_COOKIE),
      limit,
      cursor,
    ),
    200,
  );
};
