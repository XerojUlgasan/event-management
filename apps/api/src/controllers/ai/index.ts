import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { listRoute, listRouteHandler } from "./list-catalog-knowledge.js";
import { detailRoute, detailRouteHandler } from "./get-catalog-knowledge.js";
import { searchRoute, searchRouteHandler } from "./search-catalog-knowledge.js";
import {
  indexPendingRoute,
  indexPendingRouteHandler,
} from "./index-pending-catalog-knowledge.js";
const routes = new OpenAPIHono<HonoEnv>();
routes.use("/admin/ai/knowledge", requireSession, requireSystemAdmin);
routes.use("/admin/ai/knowledge/*", requireSession, requireSystemAdmin);
routes.openapi(listRoute, listRouteHandler);
routes.openapi(searchRoute, searchRouteHandler);
routes.openapi(indexPendingRoute, indexPendingRouteHandler);
routes.openapi(detailRoute, detailRouteHandler);
export default routes;
