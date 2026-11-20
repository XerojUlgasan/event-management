import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { markMessagesReadThroughData } from "../../data/messages/mark-messages-read.js";
import { body, errors, idParams } from "./http.js";

const definition = {
  method: "post" as const,
  tags: ["Messages"],
  summary: "Mark incoming messages read through a saved message",
  request: {
    params: idParams,
    body: body(z.object({ messageId: z.string().uuid() })),
  },
  responses: {
    204: { description: "Incoming messages marked read" },
    400: errors[400],
    401: errors[401],
    403: errors[403],
    404: { ...errors[404], description: "Conversation or message not found" },
  },
};

export const markCustomerConversationReadRoute = createRoute({
  ...definition,
  path: "/messages/conversations/{id}/read",
});

export const markAdminConversationReadRoute = createRoute({
  ...definition,
  path: "/admin/conversations/{id}/read",
});

export const markCustomerConversationReadRouteHandler: AppRouteHandler<
  typeof markCustomerConversationReadRoute
> = async (c) => {
  const boundary = await markMessagesReadThroughData(
    c.get("db"),
    c.req.valid("param").id,
    { role: "customer", userId: c.get("session").user.id },
    c.req.valid("json").messageId,
  );

  return boundary
    ? c.body(null, 204)
    : jsonError(c, "Conversation or message not found", 404);
};

export const markAdminConversationReadRouteHandler: AppRouteHandler<
  typeof markAdminConversationReadRoute
> = async (c) => {
  const boundary = await markMessagesReadThroughData(
    c.get("db"),
    c.req.valid("param").id,
    { role: "admin" },
    c.req.valid("json").messageId,
  );

  return boundary
    ? c.body(null, 204)
    : jsonError(c, "Conversation or message not found", 404);
};
