import {
  CONVERSATION_MESSAGE_ADDED,
  conversationMessageAddedSchema,
} from "@event-management/contracts/realtime-events";
import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { messageDto } from "../../utils/message-dto.js";
import { selectMessageColumnsData } from "./select-message-columns.js";

export async function publishConversationMessageData(
  trx: Transaction<DB>,
  conversationId: string,
  messageId: string,
) {
  const row = await selectMessageColumnsData(trx, conversationId)
    .innerJoin(
      "conversations as conversation",
      "conversation.id",
      "m.conversation_id",
    )
    .where("conversation.customer_id", "is not", null)
    .where("m.id", "=", messageId)
    .where(
      sql<boolean>`
      to_regprocedure('clemora_conversation_events.broadcast_message_added(uuid,jsonb)') is not null
      and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null
    `,
    )
    .executeTakeFirst();

  if (!row) return;

  const parsed = conversationMessageAddedSchema.safeParse({
    type: CONVERSATION_MESSAGE_ADDED,
    delivery: "inline",
    conversationId,
    message: messageDto(row),
  });

  if (!parsed.success) {
    console.warn("Conversation message did not match the Realtime contract");

    return;
  }

  // Database Broadcast becomes visible only once the message transaction commits.
  await sql`select clemora_conversation_events.broadcast_message_added(
    ${conversationId}::uuid,
    ${JSON.stringify(parsed.data)}::jsonb
  )`.execute(trx);
}
