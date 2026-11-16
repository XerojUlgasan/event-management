import type { Kysely } from "kysely";
import { GuestChatError } from "../../data/guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { messageDto, type MessageDto } from "./message-response.js";

export type SendAdminMessageResult =
  | { kind: "ok"; message: MessageDto; aiEnabled: boolean; aiVersion: number }
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
  try {
    const saved = await createMessageData(
      db,
      conversation.id,
      senderId,
      "admin",
      body,
    );
    return {
      kind: "ok",
      message: messageDto(saved.message),
      aiEnabled: saved.aiEnabled,
      aiVersion: saved.aiVersion,
    };
  } catch (error) {
    if (
      error instanceof GuestChatError ||
      (error instanceof Error && error.message === "Conversation is closed")
    )
      return { kind: "closed" };
    if (error instanceof Error && error.message === "Conversation not found")
      return { kind: "not-found" };
    throw error;
  }
}
