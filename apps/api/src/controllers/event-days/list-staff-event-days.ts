import { createRoute } from "@hono/zod-openapi";
import { listStaffEventDaysPageService } from "../../services/event-days/list-staff-event-days-page.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { tags } from "./schemas.js";
import { staffPageQuery, staffPageResponse } from "./page-schemas.js";
export const listStaffEventDaysRoute = createRoute({
  method: "get",
  path: "/staff/event-days",
  tags,
  request: { query: staffPageQuery },
  responses: staffPageResponse,
});
export const listStaffEventDaysRouteHandler: AppRouteHandler<
  typeof listStaffEventDaysRoute
> = async (c) =>
  c.json(
    await listStaffEventDaysPageService(
      c.get("db"),
      c.get("session").user.id,
      false,
      c.req.valid("query"),
    ),
    200,
  );
