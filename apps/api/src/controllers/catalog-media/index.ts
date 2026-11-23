import { OpenAPIHono } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  uploadCatalogMediaRoute,
  uploadCatalogMediaRouteHandler,
} from "./upload-catalog-media.js";
import {
  removePendingCatalogMediaRoute,
  removePendingCatalogMediaRouteHandler,
} from "./remove-pending-catalog-media.js";
import {
  getCatalogMediaRoute,
  getCatalogMediaRouteHandler,
} from "./get-catalog-media.js";

const routes = new OpenAPIHono<HonoEnv>({
  // Malformed media IDs have always returned the same 404 as missing assets.
  defaultHook: (result, c) => {
    if (!result.success) return jsonError(c, "Media not found.", 404);
  },
});

routes.use("/admin/catalog-media", requireSession, requireSystemAdmin);
routes.use("/admin/catalog-media/*", requireSession, requireSystemAdmin);

routes.openapi(uploadCatalogMediaRoute, uploadCatalogMediaRouteHandler);
routes.openapi(
  removePendingCatalogMediaRoute,
  removePendingCatalogMediaRouteHandler,
);
routes.openapi(getCatalogMediaRoute, getCatalogMediaRouteHandler);

export default routes;
