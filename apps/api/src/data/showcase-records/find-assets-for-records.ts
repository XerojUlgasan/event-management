import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, ShowcaseRecords } from "../../db/types.js";
import type { AssetRow } from "./find-showcase-record-with-media.js";
type Database = Kysely<DB> | Transaction<DB>;

/**
 * Fetches all cover and preview_video media_assets rows for a set of records
 * in one query. Returns a plain Map<asset_id, AssetRow>.
 */
export async function findAssetsForRecordsData(
  db: Database,
  records: Selectable<ShowcaseRecords>[],
): Promise<Map<string, AssetRow>> {
  const ids = new Set<string>();
  for (const r of records) {
    ids.add(r.cover_media_id);
    if (r.preview_video_id) ids.add(r.preview_video_id);
  }
  if (ids.size === 0) return new Map();

  const rows = await db
    .selectFrom("media_assets as m")
    .select(["m.id", "m.kind", "m.mime_type", "m.storage_key", "m.url"])
    .where("m.id", "in", [...ids])
    .execute();

  return new Map(rows.map((r) => [r.id, r]));
}
