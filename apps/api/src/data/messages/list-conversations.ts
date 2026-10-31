import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

type Database = Kysely<DB>;

export async function listConversationsData(db: Database, cursor?: { updatedAt: string; id: string }) {
  let query = selectConversationColumnsData(db)
    // Preserve PostgreSQL's microsecond precision in the pagination boundary.
    .select(sql<string>`to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as("cursor_updated_at"));
  if (cursor) {
    query = query.where(sql<boolean>`(c.updated_at, c.id) < (${cursor.updatedAt}::timestamptz, ${cursor.id}::uuid)`);
  }
  return query
    .orderBy("c.updated_at", "desc")
    .orderBy("c.id", "desc")
    .limit(16)
    .execute();
}
