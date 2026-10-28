import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { listAdminServicesService } from "../../services/services/list-admin-services.js";
export const listAdminServicesRoute = createRoute({
  method: "get",
  path: "/admin/services",
  tags: ["Services"],
  request: {},
  responses: {
    200: {
      content: json(z.object({ services: z.array(adminSchema) })),
      description: "Service catalog",
    },
    ...errors,
  },
});
export const listAdminServicesRouteHandler: AppRouteHandler<
  typeof listAdminServicesRoute
> = async (c) => {
  const value = await listAdminServicesService(c.get("db"));
  return c.json({ services: value }, 200);
};
