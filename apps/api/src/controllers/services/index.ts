import { OpenAPIHono, z } from "@hono/zod-openapi";
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
import { serviceUploadHandler, serviceImageHandler } from "./service-uploads.js";
import { adminSchema } from "./schemas.js";
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
const uploadBody = { required: true, content: { "multipart/form-data": { schema: { type: "object" as const, required: ["content", "image"], properties: { content: { type: "string" as const, description: "JSON service content; PATCH also requires expectedUpdatedAt" }, image: { type: "string" as const, format: "binary" } } } } } };
const uploadResponses = { 200: { description: "Updated service", content: { "application/json": { schema: adminSchema } } }, 400: { description: "Invalid input" }, 401: { description: "Authentication required" }, 403: { description: "Access denied" }, 413: { description: "Image too large" }, 502: { description: "Image storage unavailable" } };
routes.openAPIRegistry.registerPath({ method: "post", path: "/admin/service-uploads", tags: ["Services"], request: { body: uploadBody }, responses: { ...uploadResponses, 201: uploadResponses[200] } });
routes.openAPIRegistry.registerPath({ method: "patch", path: "/admin/service-uploads/{id}", tags: ["Services"], request: { params: z.object({ id: z.string().uuid() }), body: uploadBody }, responses: { ...uploadResponses, 404: { description: "Service not found" }, 409: { description: "Service changed or archived" } } });
routes.openAPIRegistry.registerPath({ method: "get", path: "/service-images/{id}", tags: ["Services"], request: { params: z.object({ id: z.string().uuid() }) }, responses: { 200: { description: "Service image", content: { "image/jpeg": { schema: { type: "string", format: "binary" } }, "image/png": { schema: { type: "string", format: "binary" } }, "image/webp": { schema: { type: "string", format: "binary" } } } }, 404: { description: "Image not found" }, 502: { description: "Image storage unavailable" } } });
const admin = requireSystemAdmin;
routes.use("/admin/service-uploads", requireSession, admin);
routes.use("/admin/service-uploads/*", requireSession, admin);
routes.post("/admin/service-uploads", serviceUploadHandler);
routes.patch("/admin/service-uploads/:id", serviceUploadHandler);
routes.get("/service-images/:id", serviceImageHandler);
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
