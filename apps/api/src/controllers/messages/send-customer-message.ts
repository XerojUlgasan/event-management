import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { messageBodySchema, messageResultSchema } from "./schemas.js";
import { json, errors, body } from "./http.js";
import { sendCustomerMessageService } from "../../services/messages/send-customer-message.js";

export const sendCustomerMessageRoute = createRoute({
  method: "post",
  path: "/messages/conversation/messages",
  tags: ["Messages"],
  summary: "Send a message to the Clemora team",
  request: { body: body(messageBodySchema) },
  responses: {
    201: { content: json(messageResultSchema), description: "Message sent" },
    400: errors[400],
    401: errors[401],
    403: errors[403],
    404: errors[404],
    409: errors[409],
  },
});
export const sendCustomerMessageRouteHandler: AppRouteHandler<typeof sendCustomerMessageRoute> = async (c) => {
  const input = c.req.valid("json");
  try {
    const message = await sendCustomerMessageService(
      c.get("db"),
      c.get("session").user.id,
      input.body,
      input.conversationId,
    );
    return c.json({ message }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Conversation not found") {
      return c.json({ error: error.message }, 404);
    }
    if (error instanceof Error && error.message === "Conversation is closed") {
      return c.json({ error: error.message }, 409);
    }
    throw error;
  }
};
