import type { Kysely, Updateable } from "kysely";
import type { Conversations, DB } from "../../db/types.js";

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
