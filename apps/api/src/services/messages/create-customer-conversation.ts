import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createConversationData } from "../../data/messages/create-conversation.js";
import { getConversationThreadService } from "./get-conversation-thread.js";

export async function createCustomerConversationService(db: Kysely<DB>, customerId: string) {
  const conversation = await createConversationData(db, customerId);
  return getConversationThreadService(db, conversation, "customer");
}