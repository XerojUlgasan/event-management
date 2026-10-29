import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { listVenuesRoute, listVenuesRouteHandler } from "./list-venues.js";
import { getVenueRoute, getVenueRouteHandler } from "./get-venue.js";
import { createVenueRoute, createVenueRouteHandler } from "./create-venue.js";
import { updateVenueRoute, updateVenueRouteHandler } from "./update-venue.js";
import { archiveVenueRoute, archiveVenueRouteHandler } from "./archive-venue.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }, 400);
  },
});

routes.use("/admin/venues", requireSession, requireSystemAdmin);
routes.use("/admin/venues/*", requireSession, requireSystemAdmin);

routes.openapi(listVenuesRoute, listVenuesRouteHandler);
routes.openapi(getVenueRoute, getVenueRouteHandler);
routes.openapi(createVenueRoute, createVenueRouteHandler);
routes.openapi(updateVenueRoute, updateVenueRouteHandler);
routes.openapi(archiveVenueRoute, archiveVenueRouteHandler);

export default routes;
