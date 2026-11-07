import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireStaffOrAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { listStaffEventsRoute, listStaffEventsRouteHandler } from "./list-staff-events.js";
import { respondToEventRoute, respondToEventRouteHandler } from "./respond-to-event.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
        400,
      );
  },
});

routes.use("/staff/events", requireSession, requireStaffOrAdmin);
routes.use("/staff/events/*", requireSession, requireStaffOrAdmin);

routes.openapi(listStaffEventsRoute, listStaffEventsRouteHandler);
routes.openapi(respondToEventRoute, respondToEventRouteHandler);

export default routes;
