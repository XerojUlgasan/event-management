import { getEventChecklistRoute, getEventChecklistRouteHandler, getEventChecklistStaffRoute } from "../event-checklists/get-event-checklist.js";
import { createEventChecklistRoute, createEventChecklistRouteHandler } from "../event-checklists/create-event-checklist.js";
import { updateEventChecklistRoute, updateEventChecklistRouteHandler, updateEventChecklistStaffRoute } from "../event-checklists/update-event-checklist.js";
import { sendEventChecklistRoute, sendEventChecklistRouteHandler } from "../event-checklists/send-event-checklist.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  cancelEventDayRoute,
  cancelEventDayRouteHandler,
} from "./cancel-event-day.js";
import {
  createEventDayRoute,
  createEventDayRouteHandler,
} from "./create-event-day.js";
import { applyResponseDeadlinesRoute, applyResponseDeadlinesRouteHandler } from "./apply-response-deadlines.js";
import {
  listAdminEventDaysRoute,
  listAdminEventDaysRouteHandler,
} from "./list-admin-event-days.js";
import {
  listStaffAssignmentsRoute,
  listStaffAssignmentsRouteHandler,
} from "./list-staff-assignments.js";
import {
  listStaffEventDaysRoute,
  listStaffEventDaysRouteHandler,
} from "./list-staff-event-days.js";
import {
  moveEventDayRoute,
  moveEventDayRouteHandler,
} from "./move-event-day.js";
import {
  respondEventDayAvailabilityRoute,
  respondEventDayAvailabilityRouteHandler,
} from "./respond-event-day-availability.js";
import {
  updateEventDayAssignmentRoute,
  updateEventDayAssignmentRouteHandler,
} from "./update-event-day-assignment.js";
import {
  updateEventDayStaffingRoute,
  updateEventDayStaffingRouteHandler,
} from "./update-event-day-staffing.js";
const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
  },
});
const staff = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "staff")
    return c.json({ error: "Staff access required" }, 403);
  await next();
});
routes.use("/admin/event-days", requireSession, requireSystemAdmin);
routes.use("/admin/event-days/*", requireSession, requireSystemAdmin);
routes.use("/staff/event-days", requireSession, staff);
routes.use("/staff/event-days/*", requireSession, staff);
routes.use("/staff/assignments", requireSession, staff);
routes.openapi(listAdminEventDaysRoute, listAdminEventDaysRouteHandler);
routes.openapi(createEventDayRoute, createEventDayRouteHandler);
routes.openapi(applyResponseDeadlinesRoute, applyResponseDeadlinesRouteHandler);
routes.openapi(listStaffEventDaysRoute, listStaffEventDaysRouteHandler);
routes.openapi(listStaffAssignmentsRoute, listStaffAssignmentsRouteHandler);
routes.openapi(
  respondEventDayAvailabilityRoute,
  respondEventDayAvailabilityRouteHandler,
);
routes.openapi(updateEventDayStaffingRoute, updateEventDayStaffingRouteHandler);
routes.openapi(
  updateEventDayAssignmentRoute,
  updateEventDayAssignmentRouteHandler,
);
routes.openapi(cancelEventDayRoute, cancelEventDayRouteHandler);
routes.openapi(moveEventDayRoute, moveEventDayRouteHandler);
routes.openapi(getEventChecklistRoute, getEventChecklistRouteHandler);
routes.openapi(getEventChecklistStaffRoute, getEventChecklistRouteHandler);
routes.openapi(createEventChecklistRoute, createEventChecklistRouteHandler);
routes.openapi(updateEventChecklistRoute, updateEventChecklistRouteHandler);
routes.openapi(updateEventChecklistStaffRoute, updateEventChecklistRouteHandler);
routes.openapi(sendEventChecklistRoute, sendEventChecklistRouteHandler);
export default routes;
