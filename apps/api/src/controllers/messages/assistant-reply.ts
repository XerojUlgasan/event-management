import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { assistantReplySchema, conversationIdBodySchema } from "./schemas.js";
import { body, errors, json } from "./http.js";
import { replyToConversationService } from "../../services/chatbot/reply.js";
import { GeminiUnavailableError } from "../../services/chatbot/gemini.js";

export const assistantReplyRoute = createRoute({
  method: "post",
  path: "/messages/conversation/assistant-reply",
  tags: ["Messages"],
  summary: "Generate a Gemini assistant reply for the active conversation",
  responses: {
    200: { content: json(assistantReplySchema), description: "Assistant reply, or the reason AI is paused" },
    401: errors[401],
    403: errors[403],
    503: errors[503],
  },
  request: { body: body(conversationIdBodySchema) },
});
export const assistantReplyRouteHandler: AppRouteHandler<typeof assistantReplyRoute> = async (c) => {
  try {
    const result = await replyToConversationService(c.get("db"), c.get("session").user.id, c.req.valid("json").conversationId);
    return result.kind === "ok"
      ? c.json({ message: result.message, status: result.status }, 200)
      : c.json({ message: null, status: result.status as "waiting_staff" | "staff" | "closed" }, 200);
  } catch (error) {
    if (error instanceof GeminiUnavailableError) {
      return c.json({ error: error.message }, 503);
    }
    throw error;
  }
};
