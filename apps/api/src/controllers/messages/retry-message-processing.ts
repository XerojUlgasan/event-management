import { errors as guestErrors } from "../guest-chat/schemas.js";
import { createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import type { AppRouteHandler } from "../../types/hono.js";
import { retryMessageProcessingService } from "../../services/messages/retry-message-processing.js";
import { GUEST_COOKIE } from "../../utils/guest-chat.js";
import { messageResultSchema } from "./schemas.js";
import { errors, json } from "./http.js";

const params = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
});

const definition = {
  method: "post" as const,
  tags: ["Messages"],
  summary: "Retry saved message processing without uploading again",
  request: { params },
  responses: {
    200: {
      content: json(messageResultSchema),
      description: "Saved message requeued",
    },
    401: errors[401],
    403: errors[403],
    404: errors[404],
    409: errors[409],
  },
};

export const retryCustomerMessageRoute = createRoute({
  ...definition,
  path: "/messages/conversations/{id}/messages/{messageId}/retry",
});

export const retryAdminMessageRoute = createRoute({
  ...definition,
  path: "/admin/conversations/{id}/messages/{messageId}/retry",
});

export const retryGuestMessageRoute = createRoute({
  ...definition,
  path: "/guest/conversations/{id}/messages/{messageId}/retry",
  responses: { ...definition.responses, ...guestErrors },
});

export const retryCustomerMessageRouteHandler: AppRouteHandler<
  typeof retryCustomerMessageRoute
> = async (c) => {
  const { id, messageId } = c.req.valid("param");

  return c.json(
    await retryMessageProcessingService(c.get("db"), id, messageId, {
      role: "customer",
      userId: c.get("session").user.id,
    }),
    200,
  );
};

export const retryAdminMessageRouteHandler: AppRouteHandler<
  typeof retryAdminMessageRoute
> = async (c) => {
  const { id, messageId } = c.req.valid("param");

  return c.json(
    await retryMessageProcessingService(c.get("db"), id, messageId, {
      role: "admin",
      userId: c.get("session").user.id,
    }),
    200,
  );
};

export const retryGuestMessageRouteHandler: AppRouteHandler<
  typeof retryGuestMessageRoute
> = async (c) => {
  const { id, messageId } = c.req.valid("param");

  return c.json(
    await retryMessageProcessingService(c.get("db"), id, messageId, {
      role: "guest",
      token: getCookie(c, GUEST_COOKIE),
    }),
    200,
  );
};
