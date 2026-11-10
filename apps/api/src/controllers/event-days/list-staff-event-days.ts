import { createRoute } from "@hono/zod-openapi";
import * as service from "../../services/event-days/list-event-days.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { listResponse, tags } from "./schemas.js";
export const listStaffEventDaysRoute = createRoute({
  method: "get",
  path: "/staff/event-days",
  tags,
  responses: listResponse,
});
export const listStaffEventDaysRouteHandler: AppRouteHandler<
  typeof listStaffEventDaysRoute
> = async (c) =>
  c.json(
    {
      eventDays: await service.listEventDaysService(
        c.get("db"),
        undefined,
        c.get("session").user.id,
      ),
    },
    200,
  );
