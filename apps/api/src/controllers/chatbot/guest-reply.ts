import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { guestReplyRequestSchema, guestReplyResponseSchema, chatbotErrorSchema } from "./schemas.js";
import { replyToGuestService } from "../../services/chatbot/reply.js";
import { GeminiUnavailableError } from "../../services/chatbot/gemini.js";

export const guestReplyRoute = createRoute({
  method: "post",
  path: "/chatbot/guest-reply",
  tags: ["Chatbot"],
  summary: "Answer a guest's event question without requiring an account",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: guestReplyRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: guestReplyResponseSchema } },
      description: "Assistant reply",
    },
    400: {
      content: { "application/json": { schema: chatbotErrorSchema } },
      description: "Invalid chat history",
    },
    503: {
      content: { "application/json": { schema: chatbotErrorSchema } },
      description: "Assistant is unavailable",
    },
  },
});
export const guestReplyRouteHandler: AppRouteHandler<typeof guestReplyRoute> = async (c) => {
  const input = c.req.valid("json");
  try {
    const reply = await replyToGuestService(
      c.get("db"),
      input.messages,
      input.context ?? {},
    );
    return c.json({ reply }, 200);
  } catch (error) {
    if (error instanceof GeminiUnavailableError) {
      return c.json({ error: error.message }, 503);
    }
    throw error;
  }
};
