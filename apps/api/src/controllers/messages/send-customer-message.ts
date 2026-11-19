import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  customerMessageBodySchema,
  customerMessageResultSchema,
} from "./schemas.js";
import { json, errors, body } from "./http.js";
import { sendCustomerMessageService } from "../../services/messages/send-customer-message.js";

export const sendCustomerMessageRoute = createRoute({
  method: "post",
  path: "/messages/conversation/messages",
  tags: ["Messages"],
  summary: "Send a message to the Clemora team",
  request: { body: body(customerMessageBodySchema) },
  responses: {
    201: {
      content: json(customerMessageResultSchema),
      description: "Customer message saved with assistant outcome",
    },
    400: errors[400],
    401: errors[401],
    403: errors[403],
    404: errors[404],
    409: errors[409],
  },
});

export const sendCustomerMessageRouteHandler: AppRouteHandler<
  typeof sendCustomerMessageRoute
> = async (c) => {
  const input = c.req.valid("json");

  try {
    const result = await sendCustomerMessageService(
      c.get("db"),
      c.get("session").user.id,
      input.body,
      input.conversationId,
      c.req.raw.signal,
      input.requestId,
    );

    return c.json(result, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Conversation not found") {
      return jsonError(c, error.message, 404);
    }

    if (error instanceof Error && error.message === "Conversation is closed") {
      return jsonError(c, error.message, 409);
    }

    if (
      error instanceof Error &&
      error.message === "Message request conflict"
    ) {
      return jsonError(c, error.message, 409);
    }

    throw error;
  }
};
