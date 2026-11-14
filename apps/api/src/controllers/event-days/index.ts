import {
  getEventChecklistRoute,
  getEventChecklistRouteHandler,
} from "../event-checklists/get-event-checklist.js";
import {
  createEventChecklistRoute,
  createEventChecklistRouteHandler,
} from "../event-checklists/create-event-checklist.js";
import {
  updateEventChecklistRoute,
  updateEventChecklistRouteHandler,
} from "../event-checklists/update-event-checklist.js";
import {
  sendEventChecklistRoute,
  sendEventChecklistRouteHandler,
} from "../event-checklists/send-event-checklist.js";
import { OpenAPIHono } from "@hono/zod-openapi";
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
import {
  listAdminEventDaysRoute,
  listAdminEventDaysRouteHandler,
} from "./list-admin-event-days.js";
import {
  moveEventDayRoute,
  moveEventDayRouteHandler,
} from "./move-event-day.js";

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

routes.use("/admin/event-days", requireSession, requireSystemAdmin);
routes.use("/admin/event-days/*", requireSession, requireSystemAdmin);
routes.openapi(listAdminEventDaysRoute, listAdminEventDaysRouteHandler);
routes.openapi(createEventDayRoute, createEventDayRouteHandler);
routes.openapi(cancelEventDayRoute, cancelEventDayRouteHandler);
routes.openapi(moveEventDayRoute, moveEventDayRouteHandler);
routes.openapi(getEventChecklistRoute, getEventChecklistRouteHandler);
routes.openapi(createEventChecklistRoute, createEventChecklistRouteHandler);
routes.openapi(updateEventChecklistRoute, updateEventChecklistRouteHandler);
routes.openapi(sendEventChecklistRoute, sendEventChecklistRouteHandler);
export default routes;
