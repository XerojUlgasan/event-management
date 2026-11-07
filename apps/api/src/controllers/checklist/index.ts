import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin, requireStaffOrAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { createChecklistRoute, createChecklistRouteHandler } from "./create-checklist.js";
import { getChecklistRoute, getChecklistRouteHandler } from "./get-checklist.js";
import { updateChecklistItemRoute, updateChecklistItemRouteHandler } from "./update-checklist-item.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
        400,
      );
  },
});

// Admin creates a checklist — System Administrator only
routes.use("/admin/booking-requests/:bookingRequestId/checklist", requireSession, requireSystemAdmin);

// Coordinator reads and updates — staff or admin
routes.use("/checklists/:bookingRequestId", requireSession, requireStaffOrAdmin);
routes.use("/checklists/:bookingRequestId/*", requireSession, requireStaffOrAdmin);

routes.openapi(createChecklistRoute, createChecklistRouteHandler);
routes.openapi(getChecklistRoute, getChecklistRouteHandler);
routes.openapi(updateChecklistItemRoute, updateChecklistItemRouteHandler);

export default routes;
