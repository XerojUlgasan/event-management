import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { showcaseDto } from "../../services/showcase/showcase-dto.js";
import { slugParams } from "./schemas.js";

export const getPublicShowcaseRecordRoute = createRoute({
  method: "get",
  path: "/showcase-records/{slug}",
  tags: ["Showcase"],
  request: { params: slugParams },
  responses: {
    200: { description: "Published showcase record" },
    404: { description: "Not found" },
  },
});

export const getPublicShowcaseRecordRouteHandler: AppRouteHandler<
  typeof getPublicShowcaseRecordRoute
> = async (c) => {
  const { slug } = c.req.valid("param");
  const dto = await showcaseDto(c.get("db"), { slug });

  if (!dto || dto.publishedAt === null)
    return c.json({ error: "Showcase not found." }, 404);

  return c.json(dto, 200);
};
