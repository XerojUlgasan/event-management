import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { getConversationThreadService } from "./get-conversation-thread.js";

export async function getCustomerConversationByIdService(db: Kysely<DB>, customerId: string, id: string) {
  await expireConversationsData(db);
  const conversation = await findConversationData(db, id);
  if (!conversation || conversation.customer_id !== customerId) return null;
  return getConversationThreadService(db, conversation, "customer");
}