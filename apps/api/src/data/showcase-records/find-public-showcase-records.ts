import type { Kysely, Transaction } from "kysely";
import { utcTimestampSql, keysetPredicate } from "../../utils/sql-page.js";
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
    .select(utcTimestampSql("published_at").as("page_sort"))
    .where("published_at", "is not", null)
    .orderBy("published_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);

  if (cursor) {
    const [ts, id] = cursor.split("_");
    query = query.where(keysetPredicate("published_at", "id", ts!, id!, "<"));
  }

  return query.execute();
};
