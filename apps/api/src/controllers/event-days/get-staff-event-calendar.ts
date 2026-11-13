import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { staffEventDayCalendarData } from "../../data/event-days/list-staff-event-days-page.js";
import { staffPageQuery } from "./page-schemas.js";
import { errors, json } from "../booking-requests/http.js";
export const getStaffEventCalendarRoute = createRoute({
  method: "get", path: "/staff/event-days/calendar", tags: ["Event staffing"],
  request: { query: staffPageQuery.pick({ search: true, filter: true }).extend({ month: z.string().regex(/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/) }) },
  responses: { 200: { content: json(z.object({ counts: z.array(z.object({ day: z.string(), count: z.number() })) })), description: "Complete month event-day counts" }, ...errors },
});
export const getStaffEventCalendarRouteHandler: AppRouteHandler<typeof getStaffEventCalendarRoute> = async c => {
  const query = c.req.valid("query");
  return c.json({ counts: await staffEventDayCalendarData(c.get("db"), c.get("session").user.id, query, query.month) }, 200);
};
