import { OpenAPIHono } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import {
  SUPPORTING_DOCUMENT_UPLOAD_BODY_LIMIT_BYTES,
  SMALL_JSON_BODY_LIMIT_BYTES,
} from "../../constants/http.js";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  listSupportingDocumentsRoute,
  listSupportingDocumentsRouteHandler,
} from "./list-supporting-documents.js";
import {
  retrySupportingDocumentRoute,
  retrySupportingDocumentRouteHandler,
} from "./retry-supporting-document.js";
import {
  uploadSupportingDocumentRoute,
  uploadSupportingDocumentRouteHandler,
} from "./upload-supporting-document.js";

const routes = new OpenAPIHono<HonoEnv>();

routes.use("/admin/ai/documents/*", requireSession, requireSystemAdmin);
routes.use(
  "/admin/ai/documents",
  bodyLimit({
    maxSize: SUPPORTING_DOCUMENT_UPLOAD_BODY_LIMIT_BYTES,
    onError: (c) => c.json({ error: "Choose a PDF up to 25 MB." }, 413),
  }),
);
routes.use(
  "/admin/ai/documents/:id/retry",
  bodyLimit({ maxSize: SMALL_JSON_BODY_LIMIT_BYTES }),
);
routes.openapi(
  listSupportingDocumentsRoute,
  listSupportingDocumentsRouteHandler,
);
routes.openapi(
  uploadSupportingDocumentRoute,
  uploadSupportingDocumentRouteHandler,
);
routes.openapi(
  retrySupportingDocumentRoute,
  retrySupportingDocumentRouteHandler,
);

export default routes;
