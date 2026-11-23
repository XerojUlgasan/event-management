import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { deleteShowcaseRecordService } from "../../services/showcase/delete-showcase-record.js";
import { idParams } from "./schemas.js";

export const deleteShowcaseRecordRoute = createRoute({
  method: "delete",
  path: "/admin/showcase-records/{id}",
  tags: ["Showcase"],
  request: { params: idParams },
  responses: {
    204: { description: "Deleted" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    404: { description: "Not found" },
  },
});

export const deleteShowcaseRecordRouteHandler: AppRouteHandler<
  typeof deleteShowcaseRecordRoute
> = async (c) => {
  const { id } = c.req.valid("param");

  if (!(await deleteShowcaseRecordService(c.get("db"), id)))
    return c.json({ error: "Showcase not found." }, 404);

  return new Response(null, { status: 204 });
};
