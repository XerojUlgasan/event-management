import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

/** Call with the current and requested gallery asset rows already locked. */
export async function replaceShowcaseGalleryData(
  db: Transaction<DB>,
  recordId: string,
  mediaIds: string[],
) {
  // Clear the positions first so a reorder can swap two occupied positions.
  const previous = await db
    .updateTable("media_assets")
    .set({ showcase_record_id: null, gallery_position: null })
    .where("showcase_record_id", "=", recordId)
    .returning("id")
    .execute();

  if (mediaIds.length) {
    const positions = mediaIds.map(
      (id, position) => sql`WHEN ${id}::uuid THEN ${position}::integer`,
    );
    await db
      .updateTable("media_assets")
      .set({
        showcase_record_id: recordId,
        gallery_position: sql<number>`CASE id ${sql.join(positions, sql` `)} END`,
      })
      .where("id", "in", mediaIds)
      .execute();
  }

  return previous
    .filter(({ id }) => !mediaIds.includes(id))
    .map(({ id }) => id);
}
