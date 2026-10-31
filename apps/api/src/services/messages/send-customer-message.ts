import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto } from "./message-response.js";

export async function sendCustomerMessageService(
  db: Kysely<DB>,
  customerId: string,
  body: string,
  conversationId?: string,
) {
  await expireConversationsData(db);
  const conversation = conversationId
    ? await findConversationData(db, conversationId)
    : await ensureConversationData(db, customerId);
  if (!conversation || conversation.customer_id !== customerId) {
    throw new Error("Conversation not found");
  }

  // The schema keeps one conversation per customer. Sending after expiry starts
  // a new active cycle while preserving the previous message history.
  if (conversation.status === "closed") {
    await updateConversationData(db, conversation.id, {
      status: "active",
      closed_at: null,
      created_at: new Date(),
      package_id: null,
      event_type: null,
      event_starts_at: null,
      event_ends_at: null,
      guest_count: null,
    });
  }

  return messageDto(
    await createMessageData(db, conversation, customerId, "customer", body),
  );
}
