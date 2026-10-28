import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "../packages/schemas.js";
import { json, idParams } from "../packages/http.js";
import { listIncludingPackagesService } from "../../services/services/list-including-packages.js";

export const listIncludingPackagesRoute = createRoute({
  method: "get", path: "/services/{id}/packages", tags: ["Services"],
  request: { params: idParams },
  responses: {
    200: { content: json(z.object({ packages: z.array(publicSchema) })), description: "Published packages that include the service" },
    404: { content: json(z.object({ error: z.string() })), description: "Service not found" },
  },
});
export const listIncludingPackagesRouteHandler: AppRouteHandler<typeof listIncludingPackagesRoute> = async c => {
  const packages = await listIncludingPackagesService(c.get("db"), c.req.valid("param").id);
  return packages ? c.json({ packages }, 200) : c.json({ error: "Service not found" }, 404);
};
