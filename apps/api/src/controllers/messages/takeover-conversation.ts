import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { errors, idParams, json } from "./http.js";
import { takeoverConversationService } from "../../services/messages/takeover-conversation.js";

export const takeoverConversationRoute = createRoute({
  method: "post",
  path: "/admin/conversations/{id}/takeover",
  tags: ["Messages"],
  summary: "Take over a conversation and pause automatic assistant replies",
  request: { params: idParams },
  responses: {
    200: { content: json(threadSchema), description: "Conversation now handled by staff" },
    ...errors,
  },
});
export const takeoverConversationRouteHandler: AppRouteHandler<typeof takeoverConversationRoute> = async (c) => {
  const result = await takeoverConversationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
  );
  if (result.kind === "ok") return c.json(result.thread, 200);
  return result.kind === "closed"
    ? c.json({ error: "Conversation is closed" }, 409)
    : c.json({ error: "Conversation not found" }, 404);
};
