import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { removePendingCatalogMediaService } from "../../services/catalog-media/remove-pending-catalog-media.js";
import { idParams } from "./schemas.js";

export const removePendingCatalogMediaRoute = createRoute({
  method: "delete",
  path: "/admin/catalog-media/{id}",
  tags: ["Catalog media"],
  request: { params: idParams },
  responses: {
    204: { description: "Discarded pending upload" },
    404: { description: "Not found" },
    409: { description: "Media is already saved" },
    502: { description: "Storage unavailable" },
  },
});

export const removePendingCatalogMediaRouteHandler: AppRouteHandler<
  typeof removePendingCatalogMediaRoute
> = async (c) => {
  const id = c.req.valid("param").id;
  const result = await removePendingCatalogMediaService(
    c.get("db"),
    id,
    c.get("session").user.id,
  );
  return result
    ? jsonError(c, result.message, result.status)
    : c.body(null, 204);
};
