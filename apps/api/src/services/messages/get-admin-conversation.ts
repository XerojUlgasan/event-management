import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findConversationData } from "../../data/messages/find-conversation.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function getAdminConversationService(
  db: Kysely<DB>,
  id: string,
  limit?: number,
  cursor?: string,
) {
  const conversation = await findConversationData(db, id);

  return conversation
    ? getConversationThreadService(db, conversation, "admin", limit, cursor)
    : null;
}
