import { OpenAPIHono } from "@hono/zod-openapi";
import {
  scheduleRequestedDaysRoute,
  scheduleRequestedDaysRouteHandler,
} from "./schedule-requested-days.js";
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
routes.openapi(scheduleRequestedDaysRoute, scheduleRequestedDaysRouteHandler);
routes.openapi(cancelEventDayRoute, cancelEventDayRouteHandler);
routes.openapi(moveEventDayRoute, moveEventDayRouteHandler);

export default routes;
