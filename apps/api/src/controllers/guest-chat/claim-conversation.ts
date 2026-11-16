import { createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { AppRouteHandler } from "../../types/hono.js";
import { GUEST_COOKIE } from "../../utils/guest-chat.js";
import { errors } from "./schemas.js";
import { body, idParams, json } from "../messages/http.js";
import { claimGuestConversationData } from "../../data/guest-chat/claim-guest-conversation.js";

export const claimGuestConversationRoute = createRoute({
  method: "post",
  path: "/guest/conversations/{id}/claim",
  tags: ["Guest chat"],
  summary: "Attach this anonymous conversation to the signed-in customer",
  request: { params: idParams, body: body(z.object({}).strict()) },
  responses: {
    200: {
      content: json(z.object({ conversationId: z.string().uuid() })),
      description: "Conversation claimed",
    },
    ...errors,
  },
});
export const claimGuestConversationRouteHandler: AppRouteHandler<
  typeof claimGuestConversationRoute
> = async (c) =>
  c.json(
    await claimGuestConversationData(
      c.get("db"),
      c.req.valid("param").id,
      getCookie(c, GUEST_COOKIE),
      c.get("session").user.id,
    ),
    200,
  );
