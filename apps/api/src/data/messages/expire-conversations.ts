import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { CONVERSATION_EXPIRY_MS } from "../../utils/conversation-expiry.js";

type Database = Kysely<DB>;

// Conversations without a selected package expire 24 hours after creation.
// Package conversations stay available until 24 hours after the event end.
export async function expireConversationsData(db: Database) {
  const cutoff = new Date(Date.now() - CONVERSATION_EXPIRY_MS);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("status", "!=", "closed")
    .where((eb) =>
      eb.or([
        eb.and([
          eb("guest_chat_id", "is not", null),
          eb("created_at", "<=", cutoff),
        ]),
        eb.and([
          eb("package_id", "is not", null),
          eb("event_ends_at", "is not", null),
          eb("event_ends_at", "<=", cutoff),
        ]),
        eb.and([
          eb("package_id", "is", null),
          eb("created_at", "<=", cutoff),
        ]),
        eb.and([
          eb("package_id", "is not", null),
          eb("event_ends_at", "is", null),
          eb("created_at", "<=", cutoff),
        ]),
      ]),
    )
    .execute();
}
