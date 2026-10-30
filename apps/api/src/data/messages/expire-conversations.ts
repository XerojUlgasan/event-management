import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { CONVERSATION_EXPIRY_MS } from "../../utils/conversation-expiry.js";

type Database = Kysely<DB>;

// General conversations expire 24 hours after their last activity. Conversations
// tied to an event stay available until 24 hours after the event end.
export async function expireConversationsData(db: Database) {
  const cutoff = new Date(Date.now() - CONVERSATION_EXPIRY_MS);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("status", "!=", "closed")
    .where((eb) =>
      eb.or([
        eb.and([eb("event_ends_at", "is not", null), eb("event_ends_at", "<=", cutoff)]),
        eb.and([eb("event_ends_at", "is", null), eb("updated_at", "<=", cutoff)]),
      ]),
    )
    .execute();
}
