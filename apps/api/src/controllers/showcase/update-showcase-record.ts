import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { updateShowcaseRecordService } from "../../services/showcase/update-showcase-record.js";
import { updateShowcaseRecordSchema, idParams } from "./schemas.js";

export const updateShowcaseRecordRoute = createRoute({
  method: "patch",
  path: "/admin/showcase-records/{id}",
  tags: ["Showcase"],
  request: {
    params: idParams,
    body: {
      required: true,
      content: { "application/json": { schema: updateShowcaseRecordSchema } },
    },
  },
  responses: {
    200: { description: "Updated showcase record" },
    400: { description: "Invalid input" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    404: { description: "Not found" },
    409: { description: "Stale update or slug conflict" },
  },
});

export const updateShowcaseRecordRouteHandler: AppRouteHandler<
  typeof updateShowcaseRecordRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  console.log("[update-showcase] body received:", JSON.stringify(body));
  const result = await updateShowcaseRecordService(c.get("db"), id, body);
  if (!result) return c.json({ error: "Showcase not found." }, 404);
  if ("status" in result) return c.json({ error: result.message }, result.status);
  return c.json(result, 200);
};
