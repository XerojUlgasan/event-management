import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";

import { messageDto } from "./message-response.js";

export async function sendCustomerMessageService(db: Kysely<DB>, customerId: string, body: string) {
  const conversation = await ensureConversationData(db, customerId);
  return messageDto(await createMessageData(db, conversation, customerId, body), conversation.customer_id);
}
