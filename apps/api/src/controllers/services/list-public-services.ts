import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "../packages/http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { listPublicServicesService } from "../../services/services/list-public-services.js";
export const listPublicServicesRoute = createRoute({
  method: "get",
  path: "/services",
  tags: ["Services"],
  request: { query: z.object({ limit: z.coerce.number().int().min(1).max(15).optional(), offset: z.coerce.number().int().min(0).default(0) }) },
  responses: {
    200: {
      content: json(z.object({ services: z.array(publicSchema), nextOffset: z.number().int().nullable() })),
      description: "Service catalog",
    },
    ...errors,
  },
});
export const listPublicServicesRouteHandler: AppRouteHandler<
  typeof listPublicServicesRoute
> = async (c) => {
  const { limit, offset } = c.req.valid("query");
  const value = await listPublicServicesService(c.get("db"), undefined, limit ? { limit: limit + 1, offset } : undefined);
  return c.json({ services: limit ? value.slice(0, limit) : value, nextOffset: limit && value.length > limit ? offset + limit : null }, 200);
};
