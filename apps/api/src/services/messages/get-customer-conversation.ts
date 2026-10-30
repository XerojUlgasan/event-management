import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function getCustomerConversationService(db: Kysely<DB>, customerId: string) {
  await expireConversationsData(db);
  return getConversationThreadService(db, await ensureConversationData(db, customerId), "customer");
}
