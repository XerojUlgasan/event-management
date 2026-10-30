import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function takeoverConversationService(db: Kysely<DB>, id: string) {
  await expireConversationsData(db);
  const conversation = await findConversationData(db, id);
  if (!conversation) return { kind: "not-found" as const };
  if (conversation.status === "closed") return { kind: "closed" as const };
  await updateConversationData(db, conversation.id, { status: "staff", updated_at: new Date() });
  const updated = await findConversationData(db, id);
  return updated
    ? {
        kind: "ok" as const,
        thread: await getConversationThreadService(db, updated, "admin"),
      }
    : { kind: "not-found" as const };
}
