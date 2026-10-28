import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB>;

export async function markMessagesReadData(
  db: Database,
  conversation: ConversationWithCustomer,
  viewer: "admin" | "customer",
) {
  const query = db
    .updateTable("messages")
    .set({ read_at: new Date() })
    .where("conversation_id", "=", conversation.id)
    .where("read_at", "is", null);

  if (viewer === "admin") {
    await query.where("sender_id", "=", conversation.customer_id).execute();
  } else {
    await query.where("sender_id", "!=", conversation.customer_id).execute();
  }
}
