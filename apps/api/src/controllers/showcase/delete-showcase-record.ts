import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { findShowcaseRecordWithMediaData } from "../../data/showcase-records/find-showcase-record-with-media.js";
import { deleteShowcaseRecordData } from "../../data/showcase-records/delete-showcase-record.js";
import { cleanupCatalogMediaService } from "../../services/catalog-media/cleanup-catalog-media.js";
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
  const existing = await findShowcaseRecordWithMediaData(c.get("db"), { id });
  if (!existing) return c.json({ error: "Showcase not found." }, 404);

  // Collect all media IDs owned by this record before deleting.
  const mediaIds = [
    existing.record.cover_media_id,
    ...(existing.record.preview_video_id ? [existing.record.preview_video_id] : []),
    ...existing.mediaRows.map((m) => m.id),
  ];

  await deleteShowcaseRecordData(c.get("db"), id);

  // Clean up orphaned media assets after the record is gone.
  await cleanupCatalogMediaService(c.get("db"), mediaIds);

  return new Response(null, { status: 204 });
};
