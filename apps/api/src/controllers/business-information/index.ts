import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  getAdminBusinessInformationRoute,
  getAdminBusinessInformationRouteHandler,
} from "./get-admin-business-information.js";
import {
  getBusinessInformationRoute,
  getBusinessInformationRouteHandler,
} from "./get-business-information.js";
import {
  saveAdminBusinessInformationRoute,
  saveAdminBusinessInformationRouteHandler,
} from "./save-admin-business-information.js";

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

routes.use("/admin/business-information", requireSession, requireSystemAdmin);
routes.use("/admin/business-information/*", requireSession, requireSystemAdmin);
routes.openapi(getBusinessInformationRoute, getBusinessInformationRouteHandler);
routes.openapi(
  getAdminBusinessInformationRoute,
  getAdminBusinessInformationRouteHandler,
);
routes.openapi(
  saveAdminBusinessInformationRoute,
  saveAdminBusinessInformationRouteHandler,
);

export default routes;
