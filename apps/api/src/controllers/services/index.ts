import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  listPublicServicesRoute,
  listPublicServicesRouteHandler,
} from "./list-public-services.js";
import {
  getPublicServiceRoute,
  getPublicServiceRouteHandler,
} from "./get-public-service.js";
import {
  listAdminServicesRoute,
  listAdminServicesRouteHandler,
} from "./list-admin-services.js";
import {
  getAdminServiceRoute,
  getAdminServiceRouteHandler,
} from "./get-admin-service.js";
import {
  createServiceRoute,
  createServiceRouteHandler,
} from "./create-service.js";
import {
  updateServiceRoute,
  updateServiceRouteHandler,
} from "./update-service.js";
import {
  archiveServiceRoute,
  archiveServiceRouteHandler,
} from "./archive-service.js";
import {
  deleteServiceRoute,
  deleteServiceRouteHandler,
} from "./delete-service.js";
const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
        400,
      );
  },
});
const admin = requireSystemAdmin;
routes.use("/admin/services", requireSession, admin);
routes.use("/admin/services/*", requireSession, admin);
routes.openapi(listPublicServicesRoute, listPublicServicesRouteHandler);
routes.openapi(getPublicServiceRoute, getPublicServiceRouteHandler);
routes.openapi(listAdminServicesRoute, listAdminServicesRouteHandler);
routes.openapi(getAdminServiceRoute, getAdminServiceRouteHandler);
routes.openapi(createServiceRoute, createServiceRouteHandler);
routes.openapi(updateServiceRoute, updateServiceRouteHandler);
routes.openapi(archiveServiceRoute, archiveServiceRouteHandler);
routes.openapi(deleteServiceRoute, deleteServiceRouteHandler);
export default routes;
