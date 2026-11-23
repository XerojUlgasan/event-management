import { createRoute, z } from "@hono/zod-openapi";
import { markNotificationReadData } from "../../data/notifications/mark-notification-read.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { errors, json } from "./http.js";

export const markNotificationReadRoute = createRoute({
  method: "post",
  path: "/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Mark one of the signed-in account's notifications as read",
  request: {
    params: z.object({ id: z.uuid() }),
    body: { content: json(z.strictObject({})) },
  },
  responses: {
    204: { description: "Notification is read" },
    400: errors[400],
    401: errors[401],
    404: errors[404],
  },
});

export const markNotificationReadRouteHandler: AppRouteHandler<
  typeof markNotificationReadRoute
> = async (c) => {
  const notification = await markNotificationReadData(
    c.get("db"),
    c.get("session").user.id,
    c.req.valid("param").id,
  );

  return notification
    ? c.body(null, 204)
    : jsonError(c, "Notification not found", 404);
};
