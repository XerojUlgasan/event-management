import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { findAdminShowcaseRecordsData } from "../../data/showcase-records/find-admin-showcase-records.js";
import { findGalleryForRecordsData } from "../../data/showcase-records/find-gallery-for-records.js";
import { findAssetsForRecordsData } from "../../data/showcase-records/find-assets-for-records.js";
import { buildShowcaseDto } from "../../services/showcase/showcase-dto.js";
import { DEFAULT_PAGE_SIZE } from "@event-management/contracts/pagination";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

export const listAdminShowcaseRecordsRoute = createRoute({
  method: "get",
  path: "/admin/showcase-records",
  tags: ["Showcase"],
  request: { query: querySchema },
  responses: {
    200: { description: "All showcase records (admin)" },
    401: { description: "Sign in required" },
    403: { description: "Admin required" },
  },
});

export const listAdminShowcaseRecordsRouteHandler: AppRouteHandler<
  typeof listAdminShowcaseRecordsRoute
> = async (c) => {
  const db = c.get("db");
  const { limit = DEFAULT_PAGE_SIZE, cursor } = c.req.valid("query");

  const rows = await findAdminShowcaseRecordsData(db, limit, cursor);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  // Fetch all gallery and asset rows in 2 queries total (not 2×N).
  const [galleryMap, assetMap] = await Promise.all([
    findGalleryForRecordsData(db, page.map((r) => r.id)),
    findAssetsForRecordsData(db, page),
  ]);

  const showcases = page.map((r) =>
    buildShowcaseDto(
      r,
      assetMap.get(r.cover_media_id) ?? null,
      r.preview_video_id ? (assetMap.get(r.preview_video_id) ?? null) : null,
      galleryMap.get(r.id) ?? [],
    ),
  );

  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? `${last.created_at.toISOString()}_${last.id}`
      : null;

  return c.json({ showcases, nextCursor }, 200);
};
