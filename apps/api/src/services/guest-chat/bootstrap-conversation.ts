import type { GuestDatabase } from "../../data/guest-chat/guest-conversation.js";
import { bootstrapGuestConversationData } from "../../data/guest-chat/guest-conversation.js";
import { getGuestChatService } from "./get-conversation.js";

export async function bootstrapGuestChatService(
  db: GuestDatabase,
  token: string,
) {
  const conversation = await bootstrapGuestConversationData(db, token);
  return getGuestChatService(db, conversation.id, token);
}
