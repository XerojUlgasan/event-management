import type { GuestDatabase } from "../../data/guest-chat/guest-conversation.js";
import {
  guestStatus,
  lockGuestConversation,
} from "../../data/guest-chat/guest-conversation.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { getConversationThreadService } from "../messages/get-conversation-thread.js";

export function getGuestChatService(
  db: GuestDatabase,
  id: string,
  token: string | undefined,
  limit?: number,
  cursor?: string,
) {
  return db.transaction().execute(async (trx) => {
    const conversation = await lockGuestConversation(trx, id, token);
    const row = await findConversationData(trx, id);

    return {
      ...(await getConversationThreadService(
        trx,
        row!,
        "customer",
        limit,
        cursor,
      )),
      guest: guestStatus(conversation),
    };
  });
}
