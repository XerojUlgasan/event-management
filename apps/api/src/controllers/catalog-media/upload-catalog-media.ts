import { createRoute } from "@hono/zod-openapi";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { uploadCatalogMediaService } from "../../services/catalog-media/upload-catalog-media.js";
import { mediaSchema } from "../packages/schemas.js";

// Keep multipart parsing in the handler to preserve duplicate-file and error responses.
export const uploadCatalogMediaRoute = createRoute({
  method: "post",
  path: "/admin/catalog-media",
  tags: ["Catalog media"],
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file"],
            properties: { file: { type: "string", format: "binary" } },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: "Pending media asset",
      content: openapiJson(mediaSchema),
    },
    400: { description: "Invalid file" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    413: { description: "File too large" },
    502: { description: "Storage unavailable" },
  },
});

export const uploadCatalogMediaRouteHandler: AppRouteHandler<
  typeof uploadCatalogMediaRoute
> = async (c) => {
  let form: FormData;
  try {
    form = await c.req.raw.formData();
  } catch {
    return jsonError(c, "Invalid multipart form.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || form.getAll("file").length !== 1)
    return jsonError(c, "Choose one media file.", 400);
  const result = await uploadCatalogMediaService(
    c.get("db"),
    c.get("session").user.id,
    file,
  );
  if ("status" in result) return jsonError(c, result.message, result.status);
  return c.json(result, 201);
};
