import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function requestStaffService(db: Kysely<DB>, customerId: string, conversationId?: string) {
  await expireConversationsData(db);
  const conversation = conversationId
    ? await findConversationData(db, conversationId)
    : await ensureConversationData(db, customerId);
  if (!conversation || conversation.customer_id !== customerId) throw new Error("Conversation not found");
  // Once staff has taken over, a customer request must not hand the thread back
  // to the waiting queue or restart automatic replies.
  if (conversation.status !== "staff") {
    const enteringStaffQueue = conversation.status !== "waiting_staff";
    await updateConversationData(db, conversation.id, {
      status: "waiting_staff",
      closed_at: null,
      updated_at: new Date(),
    });
    if (enteringStaffQueue) {
      await createMessageData(
        db,
        conversation,
        null,
        "system",
        "The customer requested staff assistance. AI responses are paused.",
        undefined,
        "Clemora",
      );
    }
  }
  const updated = await findConversationData(db, conversation.id);
  if (!updated) throw new Error("Conversation not found");
  return getConversationThreadService(db, updated, "customer");
}
