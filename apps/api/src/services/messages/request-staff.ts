import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function requestStaffService(db: Kysely<DB>, customerId: string) {
  await expireConversationsData(db);
  const conversation = await ensureConversationData(db, customerId);
  // Once staff has taken over, a customer request must not hand the thread back
  // to the waiting queue or restart automatic replies.
  if (conversation.status !== "staff") {
    await updateConversationData(db, conversation.id, {
      status: "waiting_staff",
      closed_at: null,
      updated_at: new Date(),
    });
  }
  const updated = await ensureConversationData(db, customerId);
  return getConversationThreadService(db, updated, "customer");
}
