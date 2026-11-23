import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

/** Cursor-paged list of published records only. */
export const findPublicShowcaseRecordsData = (
  db: Database,
  limit: number,
  cursor?: string,
) => {
  let query = db
    .selectFrom("showcase_records")
    .selectAll()
    .where("published_at", "is not", null)
    .orderBy("published_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);
  if (cursor) {
    const [ts, id] = cursor.split("_");
    query = query.where((eb) =>
      eb.or([
        eb("published_at", "<", new Date(ts!)),
        eb.and([eb("published_at", "=", new Date(ts!)), eb("id", "<", id!)]),
      ]),
    );
  }
  return query.execute();
};
