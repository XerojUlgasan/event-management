import { sql, type Kysely, type Transaction } from "kysely";
import { utcTimestampSql, keysetPredicate } from "../../utils/sql-page.js";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

/** Cursor-paged list visible to admins — includes drafts and published. */
export const findAdminShowcaseRecordsData = (
  db: Database,
  limit: number,
  cursor?: string,
  status?: "published" | "drafts",
  search?: string,
) => {
  let query = db
    .selectFrom("showcase_records")
    .selectAll()
    .select(utcTimestampSql("created_at").as("page_sort"))
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);

  if (status)
    query = query.where(
      "published_at",
      status === "published" ? "is not" : "is",
      null,
    );

  if (search)
    query = query.where(
      sql<boolean>`strpos(lower(title || ' ' || description), lower(${search})) > 0`,
    );

  if (cursor) {
    const [ts, id] = cursor.split("_");
    query = query.where(keysetPredicate("created_at", "id", ts!, id!, "<"));
  }

  return query.execute();
};
