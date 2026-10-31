import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { updateConversationData } from "../../data/messages/update-conversation.js";
import { createMessageData } from "../../data/messages/create-message.js";

import { getConversationThreadService } from "./get-conversation-thread.js";

export async function takeoverConversationService(db: Kysely<DB>, id: string, staffId: string) {
  await expireConversationsData(db);
  const conversation = await findConversationData(db, id);
  if (!conversation) return { kind: "not-found" as const };
  if (conversation.status === "closed") return { kind: "closed" as const };
  const staff = await db
    .selectFrom("users")
    .select(["display_name", "email"])
    .where("id", "=", staffId)
    .executeTakeFirstOrThrow();
  await createMessageData(
    db,
    conversation,
    null,
    "system",
    `${staff.display_name ?? staff.email} has taken over this conversation. AI responses are paused.`,
    "staff",
    "Clemora",
  );
  const updated = await findConversationData(db, id);
  return updated
    ? {
        kind: "ok" as const,
        thread: await getConversationThreadService(db, updated, "admin"),
      }
    : { kind: "not-found" as const };
}
