import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  listPublicServicesRoute,
  listPublicServicesRouteHandler,
} from "./list-public-services.js";
import {
  getPublicServiceRoute,
  getPublicServiceRouteHandler,
} from "./get-public-service.js";
import { listIncludingPackagesRoute, listIncludingPackagesRouteHandler } from "./list-including-packages.js";
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
  editServiceDraftRoute,
  editServiceDraftRouteHandler,
} from "./edit-service-draft.js";
import {
  publishServiceRoute,
  publishServiceRouteHandler,
} from "./publish-service.js";
import {
  archiveServiceRoute,
  archiveServiceRouteHandler,
} from "./archive-service.js";
import {
  deleteServiceRoute,
  deleteServiceRouteHandler,
} from "./delete-service.js";
import { uploadServiceImageRoute, uploadServiceImageRouteHandler } from "./upload-service-image.js";
import { getServiceImageRoute, getServiceImageRouteHandler } from "./get-service-image.js";
import { deleteServiceImageRoute, deleteServiceImageRouteHandler } from "./delete-service-image.js";
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
const admin = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin")
    return c.json({ error: "Admin access required" }, 403);
  await next();
});
routes.use("/admin/service-images", requireSession, admin);
routes.use("/admin/service-images/*", requireSession, admin);
routes.openapi(uploadServiceImageRoute, uploadServiceImageRouteHandler);
routes.openapi(getServiceImageRoute, getServiceImageRouteHandler);
routes.openapi(deleteServiceImageRoute, deleteServiceImageRouteHandler);
routes.use("/admin/services", requireSession, admin);
routes.use("/admin/services/*", requireSession, admin);
routes.openapi(listPublicServicesRoute, listPublicServicesRouteHandler);
routes.openapi(getPublicServiceRoute, getPublicServiceRouteHandler);
routes.openapi(listIncludingPackagesRoute, listIncludingPackagesRouteHandler);
routes.openapi(listAdminServicesRoute, listAdminServicesRouteHandler);
routes.openapi(getAdminServiceRoute, getAdminServiceRouteHandler);
routes.openapi(createServiceRoute, createServiceRouteHandler);
routes.openapi(editServiceDraftRoute, editServiceDraftRouteHandler);
routes.openapi(publishServiceRoute, publishServiceRouteHandler);
routes.openapi(archiveServiceRoute, archiveServiceRouteHandler);
routes.openapi(deleteServiceRoute, deleteServiceRouteHandler);
export default routes;
