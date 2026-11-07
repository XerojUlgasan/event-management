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
        LEFT JOIN booking_arrangements ba ON ba.booking_request_id = br.id
        WHERE br.id = conversations.booking_request_id
          AND (
            (
              br.status IN ('declined', 'cancelled')
              AND coalesce(ba.ends_at, br.ends_at, conversations.created_at) <= ${cutoff}
            )
            OR (
              br.status NOT IN ('declined', 'cancelled')
              AND coalesce(ba.ends_at, br.ends_at) IS NOT NULL
              AND coalesce(ba.ends_at, br.ends_at) <= ${cutoff}
              AND NOT EXISTS (
                SELECT 1
                FROM customization_requests cr
                WHERE cr.booking_request_id = br.id
                  AND cr.status = 'requested'
              )
            )
          )
      )
    )`)
    .execute();
}
