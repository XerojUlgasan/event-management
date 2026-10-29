import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
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

const admin = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin") return c.json({ error: "Admin access required" }, 403);
  await next();
});

routes.use("/admin/venues", requireSession, admin);
routes.use("/admin/venues/*", requireSession, admin);

routes.openapi(listVenuesRoute, listVenuesRouteHandler);
routes.openapi(getVenueRoute, getVenueRouteHandler);
routes.openapi(createVenueRoute, createVenueRouteHandler);
routes.openapi(updateVenueRoute, updateVenueRouteHandler);
routes.openapi(archiveVenueRoute, archiveVenueRouteHandler);

export default routes;
