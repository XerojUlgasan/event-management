import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  publicAiChatRequestSchema,
  publicAiChatResponseSchema,
} from "./schemas.js";
import { json, errors, body } from "./http.js";
import { publicAiChatService } from "../../services/ai-chat/chat-service.js";

export const publicAiChatRoute = createRoute({
  method: "post",
  path: "/ai-chat/guest",
  tags: ["AI Chat"],
  summary:
    "Send a message to the AI assistant without signing in (public, stateless)",
  description:
    "Calls the AI with live catalog context and any client-supplied history. " +
    "Does not persist messages. The client is responsible for maintaining " +
    "the conversation history array and sending it with each request.",
  request: { body: body(publicAiChatRequestSchema) },
  responses: {
    200: {
      content: json(publicAiChatResponseSchema),
      description: "AI replied successfully",
    },
    400: errors[400],
    503: errors[503],
  },
});

export const publicAiChatRouteHandler: AppRouteHandler<
  typeof publicAiChatRoute
> = async (c) => {
  const { message, history } = c.req.valid("json");

  const result = await publicAiChatService(c.get("db"), message, history);

  if ("kind" in result) {
    return c.json({ error: "AI assistant is not available right now" }, 503);
  }

  return c.json(result, 200);
};
