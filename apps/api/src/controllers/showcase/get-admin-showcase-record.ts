import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { showcaseDto } from "../../services/showcase/showcase-dto.js";
import { idParams } from "./schemas.js";

export const getAdminShowcaseRecordRoute = createRoute({
  method: "get",
  path: "/admin/showcase-records/{id}",
  tags: ["Showcase"],
  request: { params: idParams },
  responses: {
    200: { description: "Showcase record" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    404: { description: "Not found" },
  },
});

export const getAdminShowcaseRecordRouteHandler: AppRouteHandler<
  typeof getAdminShowcaseRecordRoute
> = async (c) => {
  const { id } = c.req.valid("param");
  const dto = await showcaseDto(c.get("db"), { id });

  if (!dto) return c.json({ error: "Showcase not found." }, 404);

  return c.json(dto, 200);
};
