import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto } from "./message-response.js";

export async function sendAdminMessageService(db: Kysely<DB>, id: string, senderId: string, body: string) {
  const conversation = await findConversationData(db, id);
  return conversation ? messageDto(await createMessageData(db, conversation, senderId, body), conversation.customer_id) : null;
}
