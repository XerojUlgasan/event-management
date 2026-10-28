import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "./schemas.js";
import { json } from "./http.js";
import { listPublicPackagesService } from "../../services/packages/list-public-packages.js";

const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(15).optional(), offset: z.coerce.number().int().min(0).default(0) });
export const listPublicPackagesRoute = createRoute({ method: "get", path: "/packages", tags: ["Packages"], request: { query: pageQuery }, responses: {
  200: { content: json(z.object({ packages: z.array(publicSchema), nextOffset: z.number().int().nullable() })), description: "Published packages" },
} });
export const listPublicPackagesRouteHandler: AppRouteHandler<typeof listPublicPackagesRoute> = async c => {
  const { limit, offset } = c.req.valid("query");
  const rows = await listPublicPackagesService(c.get("db"), limit ? { limit: limit + 1, offset } : undefined);
  return c.json({ packages: limit ? rows.slice(0, limit) : rows, nextOffset: limit && rows.length > limit ? offset + limit : null }, 200);
};
