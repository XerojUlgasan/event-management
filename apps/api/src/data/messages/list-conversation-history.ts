import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function listConversationHistoryData(
  db: Kysely<DB>,
  conversationId: string,
  customerMessageId: string,
) {
  // Keep PostgreSQL's full timestamp precision and the existing thread order.
  // Each turn sees all history through its own saved customer message.
  return db
    .selectFrom("messages as m")
    .select(["m.id", "m.sender_role", "m.body"])
    .where("m.conversation_id", "=", conversationId)
    .where(
      sql<boolean>`(m.created_at, m.id) <= (
        SELECT created_at, id FROM messages
        WHERE id = ${customerMessageId}::uuid
          AND conversation_id = ${conversationId}::uuid
          AND sender_role = 'customer'
      )`,
    )
    .orderBy("m.created_at", "asc")
    .orderBy("m.id", "asc")
    .execute();
}
