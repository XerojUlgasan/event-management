import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "./schemas.js";
import { json } from "./http.js";
import { listPublicPackagesService } from "../../services/packages/list-public-packages.js";

export const listPublicPackagesRoute = createRoute({ method: "get", path: "/packages", tags: ["Packages"], responses: {
  200: { content: json(z.object({ packages: z.array(publicSchema) })), description: "Published packages" },
} });
export const listPublicPackagesRouteHandler: AppRouteHandler<typeof listPublicPackagesRoute> = async c => c.json({ packages: await listPublicPackagesService(c.get("db")) }, 200);
