import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { messageBodySchema, messageResultSchema } from "./schemas.js";
import { json, errors, idParams, body } from "./http.js";
import { sendAdminMessageService } from "../../services/messages/send-admin-message.js";

export const sendAdminMessageRoute = createRoute({
  method: "post",
  path: "/admin/conversations/{id}/messages",
  tags: ["Messages"],
  summary: "Reply to a customer as staff",
  request: { params: idParams, body: body(messageBodySchema) },
  responses: {
    201: { content: json(messageResultSchema), description: "Reply sent" },
    ...errors,
  },
});
export const sendAdminMessageRouteHandler: AppRouteHandler<typeof sendAdminMessageRoute> = async (c) => {
  const message = await sendAdminMessageService(c.get("db"), c.req.valid("param").id,
    c.get("session").user.id, c.req.valid("json").body);
  return message ? c.json({ message }, 201) : c.json({ error: "Conversation not found" }, 404);
};
