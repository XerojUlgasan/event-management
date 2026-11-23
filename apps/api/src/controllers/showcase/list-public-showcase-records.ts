import { showcasePageQuery } from "./schemas.js";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { findPublicShowcaseRecordsData } from "../../data/showcase-records/find-public-showcase-records.js";
import { findGalleryForRecordsData } from "../../data/showcase-records/find-gallery-for-records.js";
import { findAssetsForRecordsData } from "../../data/showcase-records/find-assets-for-records.js";
import { buildShowcaseDto } from "../../services/showcase/showcase-dto.js";
import { DEFAULT_PAGE_SIZE } from "@event-management/contracts/pagination";

const responseSchema = z.object({
  showcases: z.array(z.any()),
  nextCursor: z.string().nullable(),
});

const querySchema = showcasePageQuery;

export const listPublicShowcaseRecordsRoute = createRoute({
  method: "get",
  path: "/showcase-records",
  tags: ["Showcase"],
  request: { query: querySchema },
  responses: {
    200: {
      description: "Published showcase records",
      content: { "application/json": { schema: responseSchema } },
    },
  },
});

export const listPublicShowcaseRecordsRouteHandler: AppRouteHandler<
  typeof listPublicShowcaseRecordsRoute
> = async (c) => {
  const db = c.get("db");
  const { limit = DEFAULT_PAGE_SIZE, cursor } = c.req.valid("query");

  const rows = await findPublicShowcaseRecordsData(db, limit, cursor);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  // Fetch all gallery and asset rows in 2 queries total (not 2×N).
  const [galleryMap, assetMap] = await Promise.all([
    findGalleryForRecordsData(
      db,
      page.map((r) => r.id),
    ),
    findAssetsForRecordsData(db, page),
  ]);

  const showcases = page.map((r) =>
    buildShowcaseDto(
      r,
      assetMap.get(r.cover_media_id) ?? null,
      galleryMap.get(r.id) ?? [],
    ),
  );

  const last = page.at(-1);
  const nextCursor =
    hasMore && last && last.published_at
      ? `${last.page_sort}_${last.id}`
      : null;

  return c.json({ showcases, nextCursor }, 200);
};
