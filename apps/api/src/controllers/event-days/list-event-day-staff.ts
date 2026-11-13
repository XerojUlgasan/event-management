import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listEventDayStaffPageService } from "../../services/event-days/list-event-day-staff-page.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { errors, json } from "../booking-requests/http.js";
import { params, tags } from "./schemas.js";
export const listEventDayStaffRoute = createRoute({
  method: "get", path: "/admin/event-days/{id}/staff", tags,
  request: { params, query: paginationQuerySchema },
  responses: { 200: { content: json(z.object({ staff: z.array(z.object({
    staffId: z.string().uuid(), staffName: z.string(), eligible: z.boolean(),
    assignment: z.object({ role: z.enum(["coordinator", "helper"]), status: z.enum(["confirmed", "cancelled"]) }).nullable(),
  })), nextCursor: z.string().nullable() })), description: "Available staff and assignments page" }, ...errors },
});
export const listEventDayStaffRouteHandler: AppRouteHandler<typeof listEventDayStaffRoute> = async c => {
  try { return c.json(await listEventDayStaffPageService(c.get("db"), c.req.valid("param").id, c.req.valid("query")), 200); }
  catch (error) { if (error instanceof Error && "status" in error && error.status === 404) return c.json({ error: error.message }, 404); throw error; }
};
