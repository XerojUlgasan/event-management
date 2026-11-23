import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { MediaRow } from "./find-showcase-record-with-media.js";
type Database = Kysely<DB> | Transaction<DB>;

/**
 * Fetches gallery rows for multiple showcase records in a single query.
 * Returns a map of record_id → ordered MediaRow[].
 */
export async function findGalleryForRecordsData(
  db: Database,
  recordIds: string[],
): Promise<Map<string, MediaRow[]>> {
  if (recordIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("showcase_record_media as srm")
    .innerJoin("media_assets as m", "m.id", "srm.media_id")
    .select([
      "srm.record_id",
      "srm.media_id as id",
      "srm.sort_order",
      "m.kind",
      "m.mime_type",
      "m.storage_key",
      "m.url",
    ])
    .where("srm.record_id", "in", recordIds)
    .orderBy("srm.record_id", "asc")
    .orderBy("srm.sort_order", "asc")
    .execute();

  const map = new Map<string, MediaRow[]>();
  for (const row of rows) {
    const list = map.get(row.record_id) ?? [];
    list.push({
      id: row.id,
      kind: row.kind,
      mime_type: row.mime_type,
      sort_order: row.sort_order,
      storage_key: row.storage_key,
      url: row.url,
    });
    map.set(row.record_id, list);
  }
  return map;
}
