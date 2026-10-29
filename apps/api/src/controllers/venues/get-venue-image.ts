import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body } from "./http.js";
import { getVenueImageService } from "../../services/venues/get-venue-image.js";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../../utils/session.js";

export const getVenueImageRoute = createRoute({ method: "get", path: "/venue-images/{id}", tags: ["Venues"], request: { params: idParams }, responses: {
  200: { content: { "image/jpeg": { schema: z.string().openapi({ format: "binary" }) }, "image/png": { schema: z.string().openapi({ format: "binary" }) } }, description: "Venue image" },
  400: errors[400], 404: errors[404],
} });
export const getVenueImageRouteHandler: AppRouteHandler<typeof getVenueImageRoute> = async c => {
  const id = c.req.valid("param").id.toLowerCase();
  const row = await getVenueImageService(c.get("db"), id, getCookie(c, SESSION_COOKIE));
  if (!row) return c.json({ error: "Image not found" }, 404);
  return c.body(new Uint8Array(row.data), 200, { "Content-Type": row.content_type, "X-Content-Type-Options": "nosniff" });
};
