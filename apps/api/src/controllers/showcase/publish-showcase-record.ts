import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publishShowcaseRecordData } from "../../data/showcase-records/publish-showcase-record.js";
import { unpublishShowcaseRecordData } from "../../data/showcase-records/unpublish-showcase-record.js";
import { showcaseDto } from "../../services/showcase/showcase-dto.js";
import { idParams } from "./schemas.js";

export const publishShowcaseRecordRoute = createRoute({
  method: "post",
  path: "/admin/showcase-records/{id}/publish",
  tags: ["Showcase"],
  request: { params: idParams },
  responses: {
    200: { description: "Published showcase record" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    404: { description: "Not found" },
  },
});

export const publishShowcaseRecordRouteHandler: AppRouteHandler<
  typeof publishShowcaseRecordRoute
> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    await publishShowcaseRecordData(c.get("db"), id, new Date());
  } catch {
    return c.json({ error: "Showcase not found." }, 404);
  }

  const dto = await showcaseDto(c.get("db"), { id });

  if (!dto) return c.json({ error: "Showcase not found." }, 404);

  return c.json(dto, 200);
};

export const unpublishShowcaseRecordRoute = createRoute({
  method: "post",
  path: "/admin/showcase-records/{id}/unpublish",
  tags: ["Showcase"],
  request: { params: idParams },
  responses: {
    200: { description: "Unpublished showcase record" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
    404: { description: "Not found" },
  },
});

export const unpublishShowcaseRecordRouteHandler: AppRouteHandler<
  typeof unpublishShowcaseRecordRoute
> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    await unpublishShowcaseRecordData(c.get("db"), id, new Date());
  } catch {
    return c.json({ error: "Showcase not found." }, 404);
  }

  const dto = await showcaseDto(c.get("db"), { id });

  if (!dto) return c.json({ error: "Showcase not found." }, 404);

  return c.json(dto, 200);
};
