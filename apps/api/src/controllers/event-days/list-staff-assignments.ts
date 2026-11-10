import { createRoute } from "@hono/zod-openapi";
import * as service from "../../services/event-days/list-event-days.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { listResponse, tags } from "./schemas.js";
export const listStaffAssignmentsRoute = createRoute({
  method: "get",
  path: "/staff/assignments",
  tags,
  responses: listResponse,
});
export const listStaffAssignmentsRouteHandler: AppRouteHandler<
  typeof listStaffAssignmentsRoute
> = async (c) =>
  c.json(
    {
      eventDays: await service.listEventDaysService(
        c.get("db"),
        undefined,
        c.get("session").user.id,
        true,
      ),
    },
    200,
  );
