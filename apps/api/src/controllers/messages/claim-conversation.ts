import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { claimConversationSchema, threadSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";
import { claimGuestConversationService } from "../../services/messages/claim-guest-conversation.js";

export const claimConversationRoute = createRoute({
  method: "post",
  path: "/messages/conversation/claim",
  tags: ["Messages"],
  summary: "Import a browser guest chat into the signed-in customer's conversation",
  request: { body: body(claimConversationSchema) },
  responses: {
    200: { content: json(threadSchema), description: "Conversation with imported messages" },
    400: errors[400],
    401: errors[401],
    403: errors[403],
  },
});
export const claimConversationRouteHandler: AppRouteHandler<typeof claimConversationRoute> = async (c) => {
  const input = c.req.valid("json");
  const result = await claimGuestConversationService(
    c.get("db"),
    c.get("session").user.id,
    input.guestChatId,
    input.messages,
    input.context,
  );
  if (result.kind === "ok") return c.json(result.thread, 200);
  return c.json(
    {
      error:
        result.kind === "invalid-package"
          ? "Package not found"
          : "Event end must be after the event start",
    },
    400,
  );
};
