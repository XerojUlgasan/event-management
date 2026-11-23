import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

/** Cursor-paged list visible to admins — includes drafts and published. */
export const findAdminShowcaseRecordsData = (
  db: Database,
  limit: number,
  cursor?: string,
) => {
  let query = db
    .selectFrom("showcase_records")
    .selectAll()
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);
  if (cursor) {
    const [ts, id] = cursor.split("_");
    query = query.where((eb) =>
      eb.or([
        eb("created_at", "<", new Date(ts!)),
        eb.and([eb("created_at", "=", new Date(ts!)), eb("id", "<", id!)]),
      ]),
    );
  }
  return query.execute();
};
