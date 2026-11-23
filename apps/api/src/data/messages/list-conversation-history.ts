import { messageImagesSelection } from "./message-images.js";
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
    .select([
      "m.id",
      "m.sender_role",
      "m.body",
      "m.catalog_browse",
      messageImagesSelection(),
    ])
    .where("m.conversation_id", "=", conversationId)
    .where(
      sql<boolean>`((m.created_at, m.id) <= (
        SELECT created_at, id FROM messages
        WHERE id = ${customerMessageId}::uuid
          AND conversation_id = ${conversationId}::uuid
          AND sender_role = 'customer'
      ) or m.reply_to_message_id in (
        select id from messages where conversation_id = ${conversationId}::uuid
          and (created_at, id) < (select created_at, id from messages where id = ${customerMessageId}::uuid)
      ))`,
    )
    .orderBy(
      sql`coalesce((select created_at from messages trigger where trigger.id = m.reply_to_message_id), m.created_at)`,
      "asc",
    )
    .orderBy(sql`coalesce(m.reply_to_message_id, m.id)`, "asc")
    .orderBy(
      sql`case when m.reply_to_message_id is null then 0 else 1 end`,
      "asc",
    )
    .orderBy("m.id", "asc")
    .execute();
}
