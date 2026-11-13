import { createRoute } from "@hono/zod-openapi";
import { listStaffEventDaysPageService } from "../../services/event-days/list-staff-event-days-page.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { tags } from "./schemas.js";
import { staffPageQuery, staffPageResponse } from "./page-schemas.js";
export const listStaffAssignmentsRoute = createRoute({
  method: "get",
  path: "/staff/assignments",
  tags,
  request: { query: staffPageQuery },
  responses: staffPageResponse,
});
export const listStaffAssignmentsRouteHandler: AppRouteHandler<
  typeof listStaffAssignmentsRoute
> = async (c) =>
  c.json(
    await listStaffEventDaysPageService(
        c.get("db"),
        c.get("session").user.id,
        true,
        c.req.valid("query"),
      ),
    200,
  );
