import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { selectMessageColumnsData } from "./select-message-columns.js";
export async function listThreadMessagesData(db: Kysely<DB>, conversationId: string, limit: number, cursor?: { createdAt: string; id: string }) {
  let query = selectMessageColumnsData(db, conversationId).select(sql<string>`to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as("cursor_created_at"));
  if (cursor) query = query.where(sql<boolean>`(m.created_at, m.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`);
  return query.orderBy("m.created_at", "desc").orderBy("m.id", "desc").limit(limit + 1).execute();
}
