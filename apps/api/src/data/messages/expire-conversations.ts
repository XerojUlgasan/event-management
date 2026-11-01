import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { CONVERSATION_EXPIRY_MS } from "../../utils/conversation-expiry.js";

type Database = Kysely<DB>;

// A booking's end time controls expiry when available; otherwise creation time does.
export async function expireConversationsData(db: Database) {
  const cutoff = new Date(Date.now() - CONVERSATION_EXPIRY_MS);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("status", "!=", "closed")
    .where(sql<boolean>`coalesce((select br.ends_at from booking_requests br where br.id = conversations.booking_request_id), conversations.created_at) <= ${cutoff}`)
    .execute();
}
