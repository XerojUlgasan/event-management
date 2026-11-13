import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto, type MessageDto } from "./message-response.js";

export type SendAdminMessageResult =
  | { kind: "ok"; message: MessageDto }
  | { kind: "not-found" }
  | { kind: "closed" };

export async function sendAdminMessageService(
  db: Kysely<DB>,
  id: string,
  senderId: string,
  body: string,
): Promise<SendAdminMessageResult> {
  const conversation = await findConversationData(db, id);
  if (!conversation) return { kind: "not-found" };
  if (conversation.status === "closed") return { kind: "closed" };
  const message = await createMessageData(db, conversation, senderId, "admin", body);
  return { kind: "ok", message: messageDto(message) };
}
