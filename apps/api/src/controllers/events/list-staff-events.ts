import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listStaffEventsService } from "../../services/events/events.js";
import { staffEventSchema } from "./schemas.js";
import { errors, json } from "./http.js";

export const listStaffEventsRoute = createRoute({
  method: "get",
  path: "/staff/events",
  tags: ["Events"],
  responses: {
    200: { content: json(z.object({ events: z.array(staffEventSchema) })), description: "Events for this staff member" },
    401: errors[401],
    403: errors[403],
  },
});

export const listStaffEventsRouteHandler: AppRouteHandler<typeof listStaffEventsRoute> = async (c) => {
  const events = await listStaffEventsService(c.get("db"), c.get("session").user.id);
  return c.json({ events }, 200);
};
