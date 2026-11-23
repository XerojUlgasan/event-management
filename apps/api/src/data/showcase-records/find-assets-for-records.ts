import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, MediaAssets, ShowcaseRecords } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export type AssetRow = Pick<
  Selectable<MediaAssets>,
  "id" | "kind" | "mime_type" | "storage_key" | "url"
>;

/**
 * Fetches all cover assets for a set of records
 * in one query. Returns a plain Map<asset_id, AssetRow>.
 */
export async function findAssetsForRecordsData(
  db: Database,
  records: Selectable<ShowcaseRecords>[],
): Promise<Map<string, AssetRow>> {
  const ids = new Set(records.map((record) => record.cover_media_id));
  if (ids.size === 0) return new Map();

  const rows = await db
    .selectFrom("media_assets as m")
    .select(["m.id", "m.kind", "m.mime_type", "m.storage_key", "m.url"])
    .where("m.id", "in", [...ids])
    .execute();

  return new Map(rows.map((r) => [r.id, r]));
}
