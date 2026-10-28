import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { json, errors, idParams, body } from "../packages/http.js";
import { getServiceImageService } from "../../services/services/get-service-image.js";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../../utils/session.js";

export const getServiceImageRoute = createRoute({ method: "get", path: "/service-images/{id}", tags: ["Services"], request: { params: idParams }, responses: {
  200: { content: { "image/jpeg": { schema: z.string().openapi({ format: "binary" }) }, "image/png": { schema: z.string().openapi({ format: "binary" }) } }, description: "Service image" },
  400: errors[400], 404: errors[404],
} });
export const getServiceImageRouteHandler: AppRouteHandler<typeof getServiceImageRoute> = async c => {
  const id = c.req.valid("param").id.toLowerCase();
  const row = await getServiceImageService(c.get("db"), id, getCookie(c, SESSION_COOKIE));
  if (!row) return c.json({ error: "Image not found" }, 404);
  return c.body(new Uint8Array(row.data), 200, { "Content-Type": row.content_type, "X-Content-Type-Options": "nosniff" });
};
