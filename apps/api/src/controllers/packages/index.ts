import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { uploadPackageImageRoute, uploadPackageImageRouteHandler } from "./upload-package-image.js";
import { getPackageImageRoute, getPackageImageRouteHandler } from "./get-package-image.js";
import { deletePackageImageRoute, deletePackageImageRouteHandler } from "./delete-package-image.js";
import { listPublicPackagesRoute, listPublicPackagesRouteHandler } from "./list-public-packages.js";
import { getPublicPackageRoute, getPublicPackageRouteHandler } from "./get-public-package.js";
import { listAdminPackagesRoute, listAdminPackagesRouteHandler } from "./list-admin-packages.js";
import { getAdminPackageRoute, getAdminPackageRouteHandler } from "./get-admin-package.js";
import { createPackageRoute, createPackageRouteHandler } from "./create-package.js";
import { editPackageDraftRoute, editPackageDraftRouteHandler } from "./edit-package-draft.js";
import { publishPackageRoute, publishPackageRouteHandler } from "./publish-package.js";
import { archivePackageRoute, archivePackageRouteHandler } from "./archive-package.js";
import { deletePackageRoute, deletePackageRouteHandler } from "./delete-package.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, 400);
  },
});
const admin = requireSystemAdmin;
routes.use("/admin/packages", requireSession, admin);
routes.use("/admin/packages/*", requireSession, admin);
routes.use("/admin/package-images", requireSession, admin);
routes.use("/admin/package-images/*", requireSession, admin);

routes.openapi(uploadPackageImageRoute, uploadPackageImageRouteHandler);
routes.openapi(getPackageImageRoute, getPackageImageRouteHandler);
routes.openapi(deletePackageImageRoute, deletePackageImageRouteHandler);
routes.openapi(listPublicPackagesRoute, listPublicPackagesRouteHandler);
routes.openapi(getPublicPackageRoute, getPublicPackageRouteHandler);
routes.openapi(listAdminPackagesRoute, listAdminPackagesRouteHandler);
routes.openapi(getAdminPackageRoute, getAdminPackageRouteHandler);
routes.openapi(createPackageRoute, createPackageRouteHandler);
routes.openapi(editPackageDraftRoute, editPackageDraftRouteHandler);
routes.openapi(publishPackageRoute, publishPackageRouteHandler);
routes.openapi(archivePackageRoute, archivePackageRouteHandler);
routes.openapi(deletePackageRoute, deletePackageRouteHandler);
export default routes;
