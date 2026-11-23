import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

/**
 * Replaces the gallery for a record with the new ordered mediaIds list.
 * Returns the IDs that were removed so the caller can run media cleanup.
 *
 * Uses delete-all + insert rather than an upsert because the table has two
 * unique indexes: (record_id, media_id) and (record_id, sort_order). An upsert
 * on one index can transiently violate the other during the same statement,
 * causing a constraint error. Delete-all-then-insert is safe and simple.
 */
export async function replaceShowcaseRecordMediaData(
  db: Transaction<DB>,
  recordId: string,
  mediaIds: string[],
): Promise<string[]> {
  // Fetch existing links to know which media IDs are being removed.
  const existing = await db
    .selectFrom("showcase_record_media")
    .select("media_id")
    .where("record_id", "=", recordId)
    .execute();

  const existingIds = new Set(existing.map((r) => r.media_id));
  const newIds = new Set(mediaIds);
  const removedMediaIds = [...existingIds].filter((id) => !newIds.has(id));

  // Delete ALL current links for this record, then re-insert in the new order.
  // This avoids any transient unique-index violations on sort_order.
  await db
    .deleteFrom("showcase_record_media")
    .where("record_id", "=", recordId)
    .execute();

  if (mediaIds.length > 0) {
    await db
      .insertInto("showcase_record_media")
      .values(
        mediaIds.map((mediaId, index) => ({
          record_id: recordId,
          media_id: mediaId,
          sort_order: index,
        })),
      )
      .execute();
  }

  return removedMediaIds;
}
