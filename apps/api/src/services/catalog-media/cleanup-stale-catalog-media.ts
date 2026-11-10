import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listStaleCatalogMediaData } from "../../data/catalog-media/list-stale-catalog-media.js";
import { cleanupCatalogMediaService } from "./cleanup-catalog-media.js";

export async function cleanupStaleCatalogMediaService(
  db: Kysely<DB>,
  limit = 100,
) {
  const rows = await listStaleCatalogMediaData(
    db,
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    limit,
  );
  await cleanupCatalogMediaService(
    db,
    rows.map((row) => row.id),
  );
  return rows.length;
}
