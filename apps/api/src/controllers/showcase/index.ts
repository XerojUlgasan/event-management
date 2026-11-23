import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  uploadShowcaseMediaRoute,
  uploadShowcaseMediaRouteHandler,
} from "./upload-showcase-media.js";
import {
  createShowcaseRecordRoute,
  createShowcaseRecordRouteHandler,
} from "./create-showcase-record.js";
import {
  listAdminShowcaseRecordsRoute,
  listAdminShowcaseRecordsRouteHandler,
} from "./list-admin-showcase-records.js";
import {
  getAdminShowcaseRecordRoute,
  getAdminShowcaseRecordRouteHandler,
} from "./get-admin-showcase-record.js";
import {
  updateShowcaseRecordRoute,
  updateShowcaseRecordRouteHandler,
} from "./update-showcase-record.js";
import {
  deleteShowcaseRecordRoute,
  deleteShowcaseRecordRouteHandler,
} from "./delete-showcase-record.js";
import {
  publishShowcaseRecordRoute,
  publishShowcaseRecordRouteHandler,
  unpublishShowcaseRecordRoute,
  unpublishShowcaseRecordRouteHandler,
} from "./publish-showcase-record.js";
import {
  listPublicShowcaseRecordsRoute,
  listPublicShowcaseRecordsRouteHandler,
} from "./list-public-showcase-records.js";
import {
  getPublicShowcaseRecordRoute,
  getPublicShowcaseRecordRouteHandler,
} from "./get-public-showcase-record.js";
import {
  getShowcaseMediaRoute,
  getShowcaseMediaRouteHandler,
} from "./get-showcase-media.js";

const routes = new OpenAPIHono<HonoEnv>();

// Admin guard — applied to all /admin/showcase* paths.
routes.use("/admin/showcase-media", requireSession, requireSystemAdmin);
routes.use("/admin/showcase-media/*", requireSession, requireSystemAdmin);
routes.use("/admin/showcase-records", requireSession, requireSystemAdmin);
routes.use("/admin/showcase-records/*", requireSession, requireSystemAdmin);

// Admin routes.
routes.openapi(uploadShowcaseMediaRoute, uploadShowcaseMediaRouteHandler);
routes.openapi(createShowcaseRecordRoute, createShowcaseRecordRouteHandler);
routes.openapi(listAdminShowcaseRecordsRoute, listAdminShowcaseRecordsRouteHandler);
routes.openapi(getAdminShowcaseRecordRoute, getAdminShowcaseRecordRouteHandler);
routes.openapi(updateShowcaseRecordRoute, updateShowcaseRecordRouteHandler);
routes.openapi(deleteShowcaseRecordRoute, deleteShowcaseRecordRouteHandler);
routes.openapi(publishShowcaseRecordRoute, publishShowcaseRecordRouteHandler);
routes.openapi(unpublishShowcaseRecordRoute, unpublishShowcaseRecordRouteHandler);

// Public routes (no auth).
routes.openapi(listPublicShowcaseRecordsRoute, listPublicShowcaseRecordsRouteHandler);
routes.openapi(getPublicShowcaseRecordRoute, getPublicShowcaseRecordRouteHandler);
routes.openapi(getShowcaseMediaRoute, getShowcaseMediaRouteHandler);

export default routes;
