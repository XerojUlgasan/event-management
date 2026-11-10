import { createRoute, z } from "@hono/zod-openapi";
import * as service from "../../services/event-days/list-event-days.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { id, listResponse, tags } from "./schemas.js";
export const listAdminEventDaysRoute = createRoute({
  method: "get",
  path: "/admin/event-days",
  tags,
  request: { query: z.object({ bookingRequestId: id }) },
  responses: listResponse,
});
export const listAdminEventDaysRouteHandler: AppRouteHandler<
  typeof listAdminEventDaysRoute
> = async (c) =>
  c.json(
    {
      eventDays: await service.listEventDaysService(
        c.get("db"),
        c.req.valid("query").bookingRequestId,
      ),
    },
    200,
  );
