import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";
import { selectMessageColumnsData } from "./select-message-columns.js";
export async function listThreadMessagesData(
  db: Kysely<DB>,
  conversationId: string,
  limit: number,
  cursor?: { createdAt: string; id: string },
) {
  let query = selectMessageColumnsData(db, conversationId).select(
    utcTimestampSql("m.created_at").as("cursor_created_at"),
  );
  if (cursor)
    query = query.where(
      keysetPredicate(
        "m.created_at",
        "m.id",
        cursor.createdAt,
        cursor.id,
        "<",
      ),
    );
  return query
    .orderBy("m.created_at", "desc")
    .orderBy("m.id", "desc")
    .limit(limit + 1)
    .execute();
}
