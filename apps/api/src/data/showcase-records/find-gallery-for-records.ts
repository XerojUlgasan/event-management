import type { Kysely, NotNull, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { AssetRow } from "./find-assets-for-records.js";

type Database = Kysely<DB> | Transaction<DB>;

/**
 * Fetches gallery rows for multiple showcase records in a single query.
 * Returns ordered media rows keyed by showcase ID.
 */
export async function findGalleryForRecordsData(
  db: Database,
  recordIds: string[],
): Promise<Map<string, AssetRow[]>> {
  if (recordIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("media_assets")
    .select([
      "showcase_record_id",
      "id",
      "kind",
      "mime_type",
      "storage_key",
      "url",
    ])
    .where("showcase_record_id", "in", recordIds)
    .orderBy("showcase_record_id")
    .orderBy("gallery_position")
    .$narrowType<{ showcase_record_id: NotNull }>()
    .execute();

  const map = new Map<string, AssetRow[]>();

  for (const { showcase_record_id, ...asset } of rows) {
    const list = map.get(showcase_record_id) ?? [];
    list.push(asset);
    map.set(showcase_record_id, list);
  }

  return map;
}
