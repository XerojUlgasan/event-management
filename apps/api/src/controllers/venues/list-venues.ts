import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, body, idParams } from "./http.js";
import { contentSchema, adminSchema, publicSchema } from "./schemas.js";
import { listVenuesService } from "../../services/venues/venues-service.js";
export const listVenuesRoute = createRoute({ method: "get", path: "/venues", tags: ["Venues"], request: {query: z.object({limit: z.coerce.number().int().min(1).max(15).optional(), offset: z.coerce.number().int().min(0).default(0)})}, responses: {200: {content: json(z.object({venues: z.array(publicSchema), nextOffset: z.number().int().nullable()})), description: "Published venues"}, ...errors} });
export const listVenuesRouteHandler: AppRouteHandler<typeof listVenuesRoute> = async c => { const {limit, offset} = c.req.valid("query"); return c.json(await listVenuesService(c.get("db"), limit, offset), 200); };
