import type { Kysely, Updateable } from "kysely";
import type { Conversations, DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB>;

export async function updateConversationData(
  db: Database,
  id: string,
  values: Updateable<Conversations>,
) {
  await db
    .updateTable("conversations")
    .set(values)
    .where("id", "=", id)
    .execute();
}

export async function updateConversationContextData(
  db: Database,
  conversation: ConversationWithCustomer,
  values: Updateable<Conversations>,
) {
  await updateConversationData(db, conversation.id, { ...values, updated_at: new Date() });
}
