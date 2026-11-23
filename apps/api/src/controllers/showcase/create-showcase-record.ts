import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { createShowcaseRecordService } from "../../services/showcase/create-showcase-record.js";
import { createShowcaseRecordSchema } from "./schemas.js";

export const createShowcaseRecordRoute = createRoute({
  method: "post",
  path: "/admin/showcase-records",
  tags: ["Showcase"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createShowcaseRecordSchema } },
    },
  },
  responses: {
    201: { description: "Created showcase record (draft)" },
    400: { description: "Invalid input" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    409: { description: "Slug conflict" },
  },
});

export const createShowcaseRecordRouteHandler: AppRouteHandler<
  typeof createShowcaseRecordRoute
> = async (c) => {
  const body = c.req.valid("json");
  const result = await createShowcaseRecordService(
    c.get("db"),
    body,
    c.get("session").user.id,
  );

  if (!result) return c.json({ error: "Failed to create showcase." }, 500);

  if ("status" in result)
    return c.json({ error: result.message }, result.status);

  return c.json(result, 201);
};
