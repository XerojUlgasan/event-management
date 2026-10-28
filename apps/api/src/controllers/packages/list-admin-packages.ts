import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { adminSchema } from "./schemas.js";
import { json, errors } from "./http.js";
import { listAdminPackagesService } from "../../services/packages/list-admin-packages.js";

export const listAdminPackagesRoute = createRoute({ method: "get", path: "/admin/packages", tags: ["Packages"], responses: {
  200: { content: json(z.object({ packages: z.array(adminSchema) })), description: "Packages" }, ...errors,
} });
export const listAdminPackagesRouteHandler: AppRouteHandler<typeof listAdminPackagesRoute> = async c => {
  return c.json({ packages: await listAdminPackagesService(c.get("db")) }, 200);
};
