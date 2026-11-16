import { createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { AppRouteHandler } from "../../types/hono.js";
import { GUEST_COOKIE } from "../../utils/guest-chat.js";
import { errors, guestThreadSchema } from "./schemas.js";
import { body, json } from "../messages/http.js";
import { createGuestToken, setGuestCookie } from "../../utils/guest-chat.js";
import { resolveGuestTokenData } from "../../data/guest-chat/guest-conversation.js";
import { bootstrapGuestChatService } from "../../services/guest-chat/bootstrap-conversation.js";

export const bootstrapGuestConversationRoute = createRoute({
  method: "post",
  path: "/guest/conversation",
  tags: ["Guest chat"],
  summary: "Resume or create this browser's anonymous conversation",
  request: { body: body(z.object({}).strict()) },
  responses: {
    200: {
      content: json(guestThreadSchema),
      description: "Anonymous conversation",
    },
    ...errors,
  },
});
export const bootstrapGuestConversationRouteHandler: AppRouteHandler<
  typeof bootstrapGuestConversationRoute
> = async (c) => {
  const presented = getCookie(c, GUEST_COOKIE);
  const token = (await resolveGuestTokenData(c.get("db"), presented))
    ? presented!
    : createGuestToken();
  const result = await bootstrapGuestChatService(c.get("db"), token);
  setGuestCookie(c, token);
  return c.json(result, 200);
};
