import {
  messageRequestBody,
  parseMessageInput,
} from "./parse-message-input.js";
import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { messageBodySchema, adminMessageResultSchema } from "./schemas.js";
import { json, errors, idParams } from "./http.js";
import { sendAdminMessageService } from "../../services/messages/send-admin-message.js";

export const sendAdminMessageRoute = createRoute({
  method: "post",
  path: "/admin/conversations/{id}/messages",
  tags: ["Messages"],
  summary: "Reply to a customer as an admin",
  request: { params: idParams, body: messageRequestBody(messageBodySchema) },
  responses: {
    201: {
      content: json(adminMessageResultSchema),
      description: "Reply sent; AI disabled",
    },
    ...errors,
    502: { description: "Image interpretation or storage failed" },
  },
});

export const sendAdminMessageRouteHandler: AppRouteHandler<
  typeof sendAdminMessageRoute
> = async (c) => {
  const input = await parseMessageInput(c);
  let result;

  try {
    result = await sendAdminMessageService(
      c.get("db"),
      c.req.valid("param").id,
      c.get("session").user.id,
      input.body,
      input.requestId,
      input.images,
      c.req.raw.signal,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Message request conflict")
      return jsonError(c, error.message, 409);

    throw error;
  }

  if (result.kind === "ok")
    return c.json(
      {
        message: result.message,
        aiEnabled: result.aiEnabled,
        aiVersion: result.aiVersion,
        aiHandoff: result.aiHandoff,
      },
      201,
    );

  return result.kind === "expired"
    ? jsonError(c, "Guest conversation expired", 409)
    : jsonError(c, "Conversation not found", 404);
};
