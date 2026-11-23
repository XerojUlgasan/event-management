import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";
import { selectConversationColumnsData } from "./select-conversation-columns.js";

export async function listConversationsData(
  db: Kysely<DB>,
  limit: number,
  cursor?: { updatedAt: string; id: string },
  customerId?: string,
  reference?: string,
) {
  let query = selectConversationColumnsData(db).select(
    utcTimestampSql("c.updated_at").as("cursor_updated_at"),
  );

  if (customerId) query = query.where("c.customer_id", "=", customerId);

  if (reference) query = query.where("br.reference", "=", reference);

  if (cursor)
    query = query.where(
      keysetPredicate(
        "c.updated_at",
        "c.id",
        cursor.updatedAt,
        cursor.id,
        "<",
      ),
    );

  return query
    .orderBy("c.updated_at", "desc")
    .orderBy("c.id", "desc")
    .limit(limit + 1)
    .execute();
}
