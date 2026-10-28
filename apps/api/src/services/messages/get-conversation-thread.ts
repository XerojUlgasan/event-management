import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "../../data/messages/types.js";
import { markMessagesReadData } from "../../data/messages/mark-messages-read.js";
import { listThreadMessagesData } from "../../data/messages/list-thread-messages.js";
import { messageDto, conversationDto } from "./message-response.js";

export async function getConversationThreadService(db: Kysely<DB>, conversation: ConversationWithCustomer, viewer: "admin" | "customer") {
  await markMessagesReadData(db, conversation, viewer);
  const messages = (await listThreadMessagesData(db, conversation.id)).map((row) => messageDto(row, conversation.customer_id));
  return { conversation: conversationDto(conversation, messages.at(-1) ?? null, 0), messages };
}

