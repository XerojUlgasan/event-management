import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { CONVERSATION_EXPIRY_MS } from "../../utils/conversation-expiry.js";

type Database = Kysely<DB>;

export async function expireConversationsData(db: Database) {
  const cutoff = new Date(Date.now() - CONVERSATION_EXPIRY_MS);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("status", "!=", "closed")
    .where(sql<boolean>`(
      (
        conversations.booking_request_id IS NULL
        AND conversations.created_at <= ${cutoff}
      )
      OR EXISTS (
        SELECT 1
        FROM booking_requests br
        WHERE br.id = conversations.booking_request_id
          AND (
            (
              br.status IN ('declined', 'cancelled')
              AND coalesce(br.ends_at, conversations.created_at) <= ${cutoff}
            )
            OR (
              br.status NOT IN ('declined', 'cancelled')
              AND br.ends_at IS NOT NULL
              AND br.ends_at <= ${cutoff}
            )
          )
      )
    )`)
    .execute();
}
