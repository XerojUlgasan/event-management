import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto } from "./message-response.js";

export async function sendCustomerMessageService(
  db: Kysely<DB>,
  customerId: string,
  body: string,
  conversationId?: string,
) {
  const conversation = conversationId
    ? await findConversationData(db, conversationId)
    : await ensureConversationData(db, customerId);
  if (!conversation || conversation.customer_id !== customerId) {
    throw new Error("Conversation not found");
  }

  // General conversations can reopen, but closed booking threads remain closed.
  if (conversation.status === "closed") {
    if (conversation.booking_request_id)
      throw new Error("Conversation is closed");
    await updateConversationData(db, conversation.id, {
      status: "active",
      closed_at: null,
    });
  }

  return messageDto(
    await createMessageData(db, conversation, customerId, "customer", body),
  );
}
