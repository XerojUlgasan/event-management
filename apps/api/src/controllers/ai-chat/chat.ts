import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { aiChatRequestSchema, aiChatResponseSchema } from "./schemas.js";
import { json, errors, body } from "./http.js";
import { aiChatService } from "../../services/ai-chat/chat-service.js";

export const aiChatRoute = createRoute({
  method: "post",
  path: "/ai-chat/message",
  tags: ["AI Chat"],
  summary:
    "Send a customer message to the AI assistant and receive an instant reply",
  description:
    "Persists the customer message, calls the AI with live catalog context, " +
    "persists the AI reply, and returns both messages. The reply is grounded " +
    "in published packages, services, and venues only.",
  request: { body: body(aiChatRequestSchema) },
  responses: {
    200: {
      content: json(aiChatResponseSchema),
      description: "AI replied successfully",
    },
    400: errors[400],
    401: errors[401],
    403: errors[403],
    404: errors[404],
    409: errors[409],
    503: errors[503],
  },
});

export const aiChatRouteHandler: AppRouteHandler<typeof aiChatRoute> = async (
  c,
) => {
  const { message, conversationId } = c.req.valid("json");
  const customerId = c.get("session").user.id;

  const result = await aiChatService(
    c.get("db"),
    customerId,
    message,
    conversationId,
  );

  if ("kind" in result) {
    switch (result.kind) {
      case "conversation-not-found":
        return c.json({ error: "Conversation not found" }, 404);
      case "conversation-closed":
        return c.json({ error: "Conversation is closed" }, 409);
      case "ai-not-configured":
        return c.json(
          { error: "AI assistant is not available right now" },
          503,
        );
      case "ai-error":
        return c.json({ error: "AI assistant is not available right now" }, 503);
    }
  }

  return c.json(result, 200);
};
